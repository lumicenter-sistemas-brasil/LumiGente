// Utils - Historico Config Module (movido de historico-config.js)
const HistoricoConfig = {
    CACHE: { EXPIRY_TIME: 30 * 60 * 1000, MAX_SIZE: 50, ENABLED: true },
    PAGINATION: { ITEMS_PER_PAGE: 20, MAX_PAGES_DISPLAYED: 10 },
    FILTERS: { DEFAULT_PERIOD: 'todos', DEFAULT_TYPE: 'todos', DEFAULT_DEPARTMENT: 'todos' },
    EXPORT: { FORMATS: ['csv', 'excel', 'pdf'], DEFAULT_FORMAT: 'csv', INCLUDE_FILTERS: true },
    CHARTS: {
        COLORS: ['#0d556d', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#3b82f6', '#059669', '#dc2626', '#7c3aed', '#0ea5e9'],
        DEFAULT_HEIGHT: 300,
        ANIMATION_DURATION: 300
    },
    PERMISSIONS: {
        ALLOWED_DEPARTMENTS: ['RH', 'Departamento de Treinamento e Desenvolvimento'],
        ALLOWED_ROLES: ['Analista de RH', 'Gerente de RH', 'Coordenador de Treinamento', 'Analista de Treinamento', 'Diretor de RH', 'Supervisor de RH', 'Especialista em Treinamento'],
        ALLOWED_PERMISSIONS: ['rh', 'treinamento', 'historico']
    },
    URLS: { EXCEL_FILES_PATH: '/historico_feedz/', API_BASE: '/api/historico', EXPORT_BASE: '/api/export' },
    MESSAGES: {
        LOADING: 'Carregando dados...',
        ERROR: 'Erro ao carregar dados',
        NO_DATA: 'Nenhum dado encontrado',
        EXPORT_SUCCESS: 'Dados exportados com sucesso',
        EXPORT_ERROR: 'Erro ao exportar dados',
        CACHE_CLEARED: 'Cache limpo com sucesso',
        PERMISSION_DENIED: 'Você não tem permissão para acessar esta funcionalidade'
    },
    DEBUG: { ENABLED: true, LOG_LEVEL: 'info', CONSOLE_LOGS: true },
    PERFORMANCE: { DEBOUNCE_DELAY: 300, THROTTLE_DELAY: 100, MAX_RENDER_ITEMS: 1000 },
    RESPONSIVE: { MOBILE_BREAKPOINT: 768, TABLET_BREAKPOINT: 1024, DESKTOP_BREAKPOINT: 1200 }
};

function getConfig(path) {
    return path.split('.').reduce((obj, key) => obj && obj[key], HistoricoConfig);
}

function setConfig(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => obj[key] = obj[key] || {}, HistoricoConfig);
    target[lastKey] = value;
}

function debugLog(level, message, data = null) {
    if (!HistoricoConfig.DEBUG.ENABLED) return;
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevel = levels.indexOf(HistoricoConfig.DEBUG.LOG_LEVEL);
    const messageLevel = levels.indexOf(level);
    if (messageLevel >= currentLevel && HistoricoConfig.DEBUG.CONSOLE_LOGS) {
        console[level](`[Historico] ${message}`, data || '');
    }
}

window.HistoricoConfig = HistoricoConfig;
window.getConfig = getConfig;
window.setConfig = setConfig;
window.debugLog = debugLog;
