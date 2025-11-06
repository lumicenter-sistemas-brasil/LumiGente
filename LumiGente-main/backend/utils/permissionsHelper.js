/**
 * Função centralizada para verificar permissões de usuário
 * Garante consistência em todo o sistema
 */

/**
 * Verifica se o usuário é RH ou T&D
 * @param {Object} user - Objeto do usuário
 * @returns {Object} - { isHR: boolean, isTD: boolean, isHRTD: boolean }
 */
function checkHRTDPermissions(user) {
    if (!user || !user.departamento) {
        return { isHR: false, isTD: false, isHRTD: false };
    }
    
    const departamento = user.departamento.toUpperCase().trim();
    
    // Verificar se é RH baseado no código do departamento (122134101 = DEPARTAMENTO ADM/RH/SESMT)
    const isHRByCode = departamento === '122134101'; // Código específico do EDILSO
    
    // Verificações mais abrangentes para RH
    const isHR = isHRByCode || 
                 departamento.includes('RH') || 
                 departamento.includes('RECURSOS HUMANOS') ||
                 departamento.includes('DEPARTAMENTO RH') ||
                 departamento.includes('ADM/RH') ||
                 departamento.includes('COORDENACAO ADM/RH') ||
                 departamento.includes('DEPARTAMENTO ADM/RH') ||
                 departamento.includes('COORDENACAO ADM/RH/SESMT') ||
                 departamento.includes('DEPARTAMENTO ADM/RH/SESMT') ||
                 departamento.includes('RH/SESMT');
                 
    // Verificações mais abrangentes para T&D
    const isTD = departamento.includes('DEPARTAMENTO TREINAM&DESENVOLV') ||
                 departamento.includes('TREINAMENTO') ||
                 departamento.includes('DESENVOLVIMENTO') ||
                 departamento.includes('T&D') ||
                 departamento.includes('TREINAM&DESENVOLV') ||
                 departamento.includes('TREINAM') ||
                 departamento.includes('DESENVOLV') ||
                 departamento.includes('TREINAMENTO E DESENVOLVIMENTO');
    
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
function isManager(user, hrTdCheck = null) {
    if (!user) return false;
    
    // Administradores são gestores
    if (user.role === 'Administrador') return true;
    
    // RH/T&D são considerados gestores APENAS se tiverem hierarchyLevel >= 3
    const { isHRTD } = hrTdCheck || checkHRTDPermissions(user);
    if (isHRTD && user.hierarchyLevel >= 3) return true;
    
    // Verificar nível hierárquico
    return user.hierarchyLevel >= 2;
}

/**
 * Verifica se o usuário pode criar pesquisas (apenas RH/T&D)
 * @param {Object} user - Objeto do usuário
 * @param {Object} hrTdCheck - Resultado pré-calculado de checkHRTDPermissions
 * @returns {boolean}
 */
function canCreateSurveys(user, hrTdCheck = null) {
    return hasFullAccess(user, hrTdCheck);
}

/**
 * Verifica se o usuário pode criar avaliações (RH/T&D/Gestores)
 * @param {Object} user - Objeto do usuário
 * @returns {boolean}
 */
function canCreateEvaluations(user) {
    return user.hierarchyLevel >= 2; // Gestores (nível 2+)
}

/**
 * Verifica se o usuário pode ver humor da empresa (RH/T&D/Gestores)
 * @param {Object} user - Objeto do usuário
 * @returns {boolean}
 */
function canViewCompanyMood(user) {
    return user.hierarchyLevel >= 2; // Gestores (nível 2+)
}

/**
 * Verifica se o usuário pode acessar histórico (apenas RH/T&D)
 * @param {Object} user - Objeto do usuário
 * @param {Object} hrTdCheck - Resultado pré-calculado de checkHRTDPermissions
 * @returns {boolean}
 */
function canAccessHistory(user, hrTdCheck = null) {
    return hasFullAccess(user, hrTdCheck);
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
    
    // OTIMIZAÇÃO: Chamar checkHRTDPermissions apenas UMA vez e reutilizar o resultado
    const hrTdCheck = checkHRTDPermissions(user);
    const { isHR, isTD, isHRTD } = hrTdCheck;
    const fullAccess = hasFullAccess(user, hrTdCheck);
    const manager = isManager(user, hrTdCheck);
    
    // Determinar tipo de gestor
    let managerType = 'Funcionário';
    if (user.role === 'Administrador') managerType = 'Administrador';
    else if (isHR) managerType = 'RH';
    else if (isTD) managerType = 'T&D';
    else if (manager) managerType = 'Gestor';
    
    return {
        dashboard: true, // Todos têm acesso ao dashboard
        feedbacks: true, // Todos podem dar feedbacks
        recognitions: true, // Todos podem dar reconhecimentos
        humor: true, // Todos podem responder humor
        objetivos: true, // Todos podem ter objetivos
        pesquisas: true, // Todos podem responder pesquisas
        avaliacoes: user.hierarchyLevel >= 2, // Gestores (nível 2+) podem ver avaliações
        team: user.hierarchyLevel >= 2, // Gestores (nível 2+) podem ver equipe
        analytics: fullAccess, // Apenas RH/T&D podem ver analytics
        historico: fullAccess, // Apenas RH/T&D podem ver histórico
        
        isManager: user.hierarchyLevel >= 2, // Gestores (nível 2+)
        isFullAccess: fullAccess,
        managerType,
        canCreatePesquisas: canCreateSurveys(user, hrTdCheck),
        canCreateAvaliacoes: canCreateEvaluations(user),
        canViewEmpresaHumor: canViewCompanyMood(user)
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
