const { getDatabasePool } = require('../config/db');
const { getHierarchyLevel } = require('../utils/hierarchyHelper');
const { hasFullAccess, isManager, checkHRTDPermissions, canCreateSurveys, canAccessHistory } = require('../utils/permissionsHelper');

/**
 * Middleware que exige que o usuário esteja autenticado.
 * Redireciona para /login se for uma requisição de página, ou retorna 401 para API.
 */
exports.requireAuth = (req, res, next) => {
    if (!req.session.user) {
        // Se é uma requisição de página HTML, redirecionar para login
        if (req.accepts('html') && !req.xhr) {
            return res.redirect('/login');
        }
        // Se é uma requisição AJAX/API, retornar erro JSON
        return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    next();
};

/**
 * Middleware para verificar se o usuário é gestor, do RH ou T&D.
 */
exports.requireManagerAccess = async (req, res, next) => {
    const user = req.session.user;

    if (!user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    if (user.role === 'Administrador') {
        return next();
    }

    if (hasFullAccess(user)) {
        return next();
    }

    // Verificar se é gestor (aparece como responsável na HIERARQUIA_CC)
    try {
        const pool = await getDatabasePool();
        
        // Verificar se o usuário tem matrícula válida
        if (!user.matricula || typeof user.matricula !== 'string' || user.matricula.trim() === '') {
            return res.status(403).json({
                error: 'Acesso negado. Usuário sem matrícula válida.'
            });
        }
        
        const [rows] = await pool.execute(`
            SELECT COUNT(*) as count
            FROM HIERARQUIA_CC
            WHERE RESPONSAVEL_ATUAL = ?
               OR NIVEL_1_MATRICULA_RESP = ?
               OR NIVEL_2_MATRICULA_RESP = ?
               OR NIVEL_3_MATRICULA_RESP = ?
               OR NIVEL_4_MATRICULA_RESP = ?
        `, [user.matricula, user.matricula, user.matricula, user.matricula, user.matricula]);

        const isManagerCheck = rows[0].count > 0;

        if (isManagerCheck) {
            return next();
        }

        if (user.hierarchyLevel >= 3) {
            return next();
        }
        return res.status(403).json({
            error: 'Acesso negado. Apenas gestores, RH e T&D podem acessar este recurso.'
        });
    } catch (error) {
        console.error('❌ Erro ao verificar acesso de gestor:', error);
        return res.status(500).json({ error: 'Erro ao verificar permissões. Tente novamente.' });
    }
};

/**
 * Middleware para verificar se o usuário pertence aos departamentos de RH ou T&D.
 */
exports.requireHRAccess = (req, res, next) => {
    const user = req.session.user;

    if (!user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const { isHRTD } = checkHRTDPermissions(user);

    if (!isHRTD) {
        console.log('🚫 ACESSO NEGADO RH/T&D:', user.nomeCompleto, '-', user.departamento);
        return res.status(403).json({
            error: 'Acesso negado. Apenas usuários do RH e Treinamento & Desenvolvimento podem realizar esta ação.',
            userDepartment: user.departamento
        });
    }
    
    console.log('✅ ACESSO LIBERADO RH/T&D:', user.nomeCompleto, '-', user.departamento);
    next();
};


/**
 * Middleware para verificar acesso a resultados de pesquisas, restrito a RH e T&D.
 */
exports.requireSurveyResultsAccess = (req, res, next) => {
    const user = req.session.user;

    if (!user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const { isHRTD } = checkHRTDPermissions(user);

    if (!isHRTD) {
        return res.status(403).json({
            error: 'Acesso negado. Apenas usuários do RH e Treinamento & Desenvolvimento podem acessar relatórios de pesquisa.',
        });
    }
    next();
};

/**
 * Middleware para verificar acesso a Usuários Externos
 * Apenas usuários com DescricaoDepartamento = 'DEPARTAMENTO TREINAM&DESENVOLV' ou 'SUPERVISAO RH'
 */
exports.requireExternalUserAccess = (req, res, next) => {
    const user = req.session.user;

    if (!user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    if (user.role === 'Administrador') {
        return next();
    }

    const departmentDesc = (user.descricaoDepartamento || user.DescricaoDepartamento || '').toString().toUpperCase().trim();
    
    const allowedDepartments = [
        'DEPARTAMENTO TREINAM&DESENVOLV',
        'SUPERVISAO RH'
    ];

    const hasAccess = allowedDepartments.some(dept => departmentDesc === dept || departmentDesc.includes(dept));

    if (!hasAccess) {
        return res.status(403).json({
            error: 'Acesso negado. Apenas usuários do DEPARTAMENTO TREINAM&DESENVOLV ou SUPERVISAO RH podem acessar esta funcionalidade.',
            userDepartment: departmentDesc
        });
    }
    next();
};


/**
 * Middleware que retorna uma função para verificar o nível hierárquico mínimo.
 * @param {number} minLevel - O nível hierárquico mínimo necessário.
 */
exports.requireHierarchyLevel = (minLevel) => {
    return (req, res, next) => {
        const user = req.session.user;

        if (!user) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        // Administradores sempre têm acesso
        if (user.role === 'Administrador') {
            return next();
        }

        // Usar hierarchyLevel da sessão (que vem do banco ou é calculado dinamicamente)
        const userLevel = user.hierarchyLevel || 0;

        if (userLevel >= minLevel) {
            return next();
        }

        return res.status(403).json({
            error: `Acesso negado. Nível hierárquico mínimo requerido: ${minLevel}. Seu nível é: ${userLevel}.`
        });
    };
};

/**
 * Middleware para verificar acesso a funcionalidades específicas baseado na hierarquia e departamento.
 * Adaptado do server1.js para manter compatibilidade com o sistema de controle de acesso.
 */
exports.requireFeatureAccess = (feature) => {
    return (req, res, next) => {
        const user = req.session.user;

        if (!user) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        // Administradores sempre têm acesso
        if (user.role === 'Administrador') {
            return next();
        }

        const { isHR, isTD } = checkHRTDPermissions(user);
        const manager = isManager(user);

        // Definir regras de acesso por funcionalidade
        switch (feature) {
            case 'analytics':
            case 'relatorios':
                if (manager || isTD) return next();
                break;

            case 'pesquisas':
                if (canCreateSurveys(user)) return next();
                if (req.method === 'GET' && !req.path.includes('/resultados') && !req.path.includes('/meta/')) return next();
                break;

            case 'avaliacoes':
                if (isHR || isTD || manager) return next();
                if (req.method === 'GET') return next();
                break;

            case 'historico':
                if (canAccessHistory(user, { isHR, isTD, isHRTD: isHR || isTD })) return next();
                break;

            case 'team':
            case 'equipe':
                if (manager) return next();
                break;

            case 'humor_empresa':
                if (manager || isHR || isTD) return next();
                break;

            default:
                return next();
        }
        return res.status(403).json({
            error: `Acesso negado. Você não tem permissão para acessar ${feature}.`,
            requiredLevel: feature === 'analytics' || feature === 'relatorios' ? 'Gestor ou T&D' : feature === 'historico' ? 'Gestor RH/T&D ou T&D' : 'Permissão restrita'
        });
    };
};

/**
 * Middleware para verificar se um usuário pode acessar os dados de outro.
 */
exports.canAccessUser = async (req, res, next) => {
    try {
        const targetUserId = req.params.userId || req.body.userId;
        if (!targetUserId) {
            return next(); // Nenhuma verificação necessária se não houver um ID de destino
        }

        const currentUser = req.session.user;

        // Administradores podem acessar tudo
        if (currentUser.role === 'Administrador') {
            return next();
        }

        const pool = await getDatabasePool();
        const [rows] = await pool.execute(
            `SELECT HierarchyPath, Departamento, Matricula FROM Users WHERE Id = ?`,
            [targetUserId]
        );

        const targetUser = rows[0];
        if (!targetUser) {
            return res.status(404).json({ error: 'Usuário alvo não encontrado' });
        }

        // Calcular HierarchyLevel do alvo dinamicamente
        targetUser.HierarchyLevel = getHierarchyLevel(targetUser.HierarchyPath, targetUser.Matricula, targetUser.Departamento);

        // Verificar hierarquia: um superior pode acessar um subordinado
        if (currentUser.hierarchyLevel > targetUser.HierarchyLevel) {
            return next();
        }

        // Mesmo nível só pode acessar se for do mesmo departamento
        if (currentUser.hierarchyLevel === targetUser.HierarchyLevel && currentUser.departamento === targetUser.Departamento) {
            return next();
        }

        return res.status(403).json({ error: 'Acesso negado. Permissão insuficiente para acessar os dados deste usuário.' });
    } catch (error) {
        console.error('Erro ao verificar permissões de acesso ao usuário:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};
