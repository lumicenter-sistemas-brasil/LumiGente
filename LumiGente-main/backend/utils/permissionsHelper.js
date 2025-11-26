/**
 * Função centralizada para verificar permissões de usuário
 * Garante consistência em todo o sistema
 */

/**
 * Verifica se o usuário é RH ou T&D
 * @param {Object} user - Objeto do usuário
 * @returns {Object} - { isHR: boolean, isTD: boolean, isHRTD: boolean }
 */
function normalizeDepartment(value) {
    return value ? String(value).toUpperCase().trim() : '';
}

function departmentMatches(departmentPool, predicate) {
    return departmentPool.some(dep => predicate(dep));
}

function checkHRTDPermissions(user) {
    if (!user) {
        return { isHR: false, isTD: false, isHRTD: false };
    }

    const departmentCode = normalizeDepartment(user.departamento);
    const departmentDesc = normalizeDepartment(user.descricaoDepartamento || user.DescricaoDepartamento);
    const departmentPool = [departmentCode, departmentDesc].filter(Boolean);

    // Códigos específicos para departamentos RH e T&D
    const HR_DEPARTMENT_CODES = ['122134101', '121511100'];
    const TD_DEPARTMENT_CODES = ['121411100'];

    const isHR = departmentMatches(departmentPool, dep => {
        if (!dep) return false;
        return HR_DEPARTMENT_CODES.includes(dep) ||
            dep.includes('DEPARTAMENTO RH') ||
            dep.includes('SUPERVISAO RH') ||
            dep.includes('ADM/RH') ||
            dep.includes('RH/SESMT') ||
            dep.includes('RECURSOS HUMANOS');
    });

    const isTD = departmentMatches(departmentPool, dep => {
        if (!dep) return false;
        return TD_DEPARTMENT_CODES.includes(dep) ||
            dep.includes('DEPARTAMENTO TREINAM&DESENVOLV') ||
            dep.includes('TREINAMENTO') ||
            dep.includes('TREINAM&DESENVOLV') ||
            dep.includes('TREINAMENTO E DESENVOLVIMENTO') ||
            dep.includes('T&D');
    });

    return { isHR, isTD, isHRTD: isHR || isTD };
}

/**
 * Verifica se o usuário tem acesso total (RH/T&D/Admin)
 * @param {Object} user - Objeto do usuário
 * @param {Object} hrTdCheck - Resultado pré-calculado de checkHRTDPermissions
 * @returns {boolean}
 */
function hasFullAccess(user, hrTdCheck = null) {
    if (!user) return false;
    
    // Administradores sempre têm acesso total
    if (user.role === 'Administrador') return true;
    
    // RH e T&D têm acesso total
    const { isHRTD } = hrTdCheck || checkHRTDPermissions(user);
    return isHRTD;
}

/**
 * Verifica se o usuário é gestor (nível hierárquico >= 3)
 * @param {Object} user - Objeto do usuário
 * @param {Object} hrTdCheck - Resultado pré-calculado de checkHRTDPermissions
 * @returns {boolean}
 */
function isManager(user) {
    if (!user) return false;
    if (user.role === 'Administrador') return true;
    return Number(user.hierarchyLevel || 0) >= 2;
}

/**
 * Verifica se o usuário pode criar pesquisas (apenas RH/T&D)
 * @param {Object} user - Objeto do usuário
 * @param {Object} hrTdCheck - Resultado pré-calculado de checkHRTDPermissions
 * @returns {boolean}
 */
function canCreateSurveys(user) {
    if (!user) return false;
    if (user.role === 'Administrador') return true;

    const departmentDesc = normalizeDepartment(user.descricaoDepartamento || user.DescricaoDepartamento);
    const allowedDepartments = [
        'DEPARTAMENTO RH',
        'SUPERVISAO RH',
        'DEPARTAMENTO TREINAM&DESENVOLV'
    ];
    return allowedDepartments.includes(departmentDesc);
}

/**
 * Verifica se o usuário pode criar avaliações (RH/T&D/Gestores)
 * @param {Object} user - Objeto do usuário
 * @returns {boolean}
 */
function canCreateEvaluations(user, hrTdCheck = null) {
    const { isHRTD } = hrTdCheck || checkHRTDPermissions(user);
    return isHRTD || isManager(user); // RH/T&D ou gestores (nível 2+)
}

/**
 * Verifica se o usuário pode ver humor da empresa (RH/T&D/Gestores)
 * @param {Object} user - Objeto do usuário
 * @returns {boolean}
 */
function canViewCompanyMood(user, hrTdCheck = null) {
    const { isHRTD } = hrTdCheck || checkHRTDPermissions(user);
    return isHRTD || isManager(user); // RH/T&D ou gestores (nível 2+)
}

/**
 * Verifica se o usuário pode acessar histórico (apenas RH/T&D)
 * @param {Object} user - Objeto do usuário
 * @param {Object} hrTdCheck - Resultado pré-calculado de checkHRTDPermissions
 * @returns {boolean}
 */
function canAccessHistory(user, hrTdCheck = null) {
    if (!user) return false;
    const { isHR, isTD } = hrTdCheck || checkHRTDPermissions(user);
    const manager = isManager(user);
    return isTD || (manager && (isHR || isTD));
}

/**
 * Verifica se o usuário pode ver resultados de pesquisas (apenas RH/T&D)
 * @param {Object} user - Objeto do usuário
 * @param {Object} hrTdCheck - Resultado pré-calculado de checkHRTDPermissions
 * @returns {boolean}
 */
function canViewSurveyResults(user, hrTdCheck = null) {
    return hasFullAccess(user, hrTdCheck);
}

/**
 * Retorna todas as permissões do usuário
 * @param {Object} user - Objeto do usuário
 * @returns {Object} - Objeto com todas as permissões
 */
function getAllPermissions(user) {
    if (!user) {
        return {
            dashboard: false, feedbacks: false, recognitions: false, humor: false, 
            objetivos: false, pesquisas: false, avaliacoes: false, team: false, 
            analytics: false, historico: false,
            isManager: false, isFullAccess: false, managerType: 'Nenhum',
            canCreatePesquisas: false, canCreateAvaliacoes: false, canViewEmpresaHumor: false
        };
    }
    
    // Verificar se é usuário externo
    const isExternal = user.isExternal === true || user.isExternal === 1 || user.role === 'Usuário Externo';
    
    // Se for usuário externo, retornar permissões específicas
    if (isExternal) {
        return {
            dashboard: true, // Dashboard normal
            feedbacks: true, // Feedbacks normal
            recognitions: true, // Reconhecimentos normal
            humor: false, // Não tem acesso a humor
            objetivos: true, // Objetivos (apenas criar para si próprio - controlado no frontend)
            pesquisas: false, // Não tem acesso a pesquisas
            avaliacoes: false, // Não tem acesso a avaliações
            team: false, // Não tem acesso a equipe
            analytics: false, // Não tem acesso a analytics
            historico: false, // Não tem acesso a histórico
            externalUsers: false, // Não pode gerenciar outros usuários externos
            
            isManager: false,
            isFullAccess: false,
            managerType: 'Usuário Externo',
            canCreatePesquisas: false,
            canCreateAvaliacoes: false,
            canViewEmpresaHumor: false
        };
    }
    
    // OTIMIZAÇÃO: Chamar checkHRTDPermissions apenas UMA vez e reutilizar o resultado
    const hrTdCheck = checkHRTDPermissions(user);
    const { isHR, isTD, isHRTD } = hrTdCheck;
    const fullAccess = hasFullAccess(user, hrTdCheck);
    const manager = isManager(user);
    const canCreateEval = canCreateEvaluations(user, hrTdCheck);
    const canViewMood = canViewCompanyMood(user, hrTdCheck);
    const canAccessTeam = manager;
    const canAccessReports = manager || isTD;
    const canAccessHistorico = isTD || (manager && (isHR || isTD));
 
    // Determinar tipo de gestor
    let managerType = 'Funcionário';
    if (user.role === 'Administrador') managerType = 'Administrador';
    else if (manager && isHR) managerType = 'Gestor RH';
    else if (manager && isTD) managerType = 'Gestor T&D';
    else if (manager) managerType = 'Gestor';
    else if (isHR) managerType = 'RH';
    else if (isTD) managerType = 'T&D';
 
    // Verificar acesso a Usuários Externos
    const departmentDesc = normalizeDepartment(user.descricaoDepartamento || user.DescricaoDepartamento);
    const allowedDepartmentsForExternal = [
        'DEPARTAMENTO TREINAM&DESENVOLV',
        'SUPERVISAO RH'
    ];
    const canAccessExternalUsers = user.role === 'Administrador' || 
        allowedDepartmentsForExternal.some(dept => departmentDesc === dept || departmentDesc.includes(dept));

    return {
        dashboard: true, // Todos têm acesso ao dashboard
        feedbacks: true, // Todos podem dar feedbacks
        recognitions: true, // Todos podem dar reconhecimentos
        humor: true, // Todos podem responder humor
        objetivos: true, // Todos podem ter objetivos
        pesquisas: true, // Todos podem responder pesquisas
        avaliacoes: true, // Todos devem ter acesso à aba
        team: canAccessTeam,
        analytics: canAccessReports,
        historico: canAccessHistorico,
        externalUsers: canAccessExternalUsers,
        
        isManager: manager,
        isFullAccess: fullAccess,
        managerType,
        canCreatePesquisas: canCreateSurveys(user),
        canCreateAvaliacoes: fullAccess || canCreateEval,
        canViewEmpresaHumor: fullAccess || canViewMood
    };
}

module.exports = {
    checkHRTDPermissions,
    hasFullAccess,
    isManager,
    canCreateSurveys,
    canCreateEvaluations,
    canViewCompanyMood,
    canAccessHistory,
    canViewSurveyResults,
    getAllPermissions
};