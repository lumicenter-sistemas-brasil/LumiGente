const rateLimit = require('express-rate-limit');

// Função para verificar se é IP da empresa
const isCompanyIP = (req) => {
    const companyIP = process.env.COMPANY_IP;
    if (!companyIP) return false;
    
    const ip = req.ip || req.connection.remoteAddress;
    return ip === companyIP || ip === `::ffff:${companyIP}`;
};

// Rate limiter geral para todas as rotas da API
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    max: (req) => {
        if (isCompanyIP(req)) {
            return parseInt(process.env.RATE_LIMIT_COMPANY_MAX) || 10000;
        }
        return parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500;
    },
    message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter mais restritivo para login
const loginLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    max: (req) => {
        if (isCompanyIP(req)) {
            return parseInt(process.env.RATE_LIMIT_COMPANY_LOGIN_MAX) || 1000;
        }
        return parseInt(process.env.RATE_LIMIT_LOGIN_MAX) || 5;
    },
    message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

// Rate limiter para criação de recursos
const createLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_CREATE_WINDOW_MS) || 60000,
    max: (req) => {
        if (isCompanyIP(req)) {
            return parseInt(process.env.RATE_LIMIT_COMPANY_CREATE_MAX) || 1000;
        }
        return parseInt(process.env.RATE_LIMIT_CREATE_MAX) || 10;
    },
    message: { error: 'Muitas criações. Aguarde um momento.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter para verificação de tokens (prevenir força bruta)
const tokenVerificationLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_TOKEN_WINDOW_MS) || 300000,
    max: (req) => {
        if (isCompanyIP(req)) {
            return parseInt(process.env.RATE_LIMIT_COMPANY_TOKEN_MAX) || 20;
        }
        return parseInt(process.env.RATE_LIMIT_TOKEN_MAX) || 5;
    },
    message: (req) => {
        const minutes = Math.ceil((parseInt(process.env.RATE_LIMIT_TOKEN_WINDOW_MS) || 300000) / 60000);
        return { error: `Muitas tentativas de verificação. Aguarde ${minutes} minutos.` };
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

// Middleware de log de auditoria
const auditLog = (action) => {
    return (req, res, next) => {
        // Logs detalhados apenas em desenvolvimento
        if (process.env.NODE_ENV !== 'production') {
            const user = req.session?.user;
            const timestamp = new Date().toISOString();
            const ip = req.ip || req.connection.remoteAddress;
            
            console.log(`[AUDIT] ${timestamp} | ${action} | User: ${user?.nomeCompleto || 'Anônimo'} (ID: ${user?.userId || 'N/A'}) | IP: ${ip}`);
        }
        
        next();
    };
};

// Middleware para sanitizar inputs
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj
                .replace(/[<>]/g, '')           // XSS
                .replace(/['"`;]/g, '')         // SQL Injection
                .replace(/[`|&$]/g, '')         // Command Injection  
                .replace(/\.\.\/|\.\.\\/g, '') // Path Traversal
                .trim();
        }
        if (typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach(key => {
                obj[key] = sanitize(obj[key]);
            });
        }
        return obj;
    };

    if (req.body) req.body = sanitize(req.body);
    if (req.query) req.query = sanitize(req.query);
    if (req.params) req.params = sanitize(req.params);
    
    next();
};

module.exports = {
    apiLimiter,
    loginLimiter,
    createLimiter,
    tokenVerificationLimiter,
    auditLog,
    sanitizeInput
};
