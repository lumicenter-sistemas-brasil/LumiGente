// LumiGente-main/server.js

require('dotenv').config({ path: './config.env' });
const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const helmet = require('helmet');
const { getDatabasePool } = require('./config/db');
const allRoutes = require('./routes');
const SincronizadorDadosExternos = require('./services/sincronizador_dados_externos');
const scheduleJobs = require('./jobs/schedule');
const { apiLimiter, sanitizeInput } = require('./middleware/securityMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares de segurança
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: process.env.HELMET_CROSS_ORIGIN_EMBEDDER_POLICY === 'true'
}));
app.use(cors({ 
    credentials: true,
    origin: process.env.CORS_ORIGIN || '*'
}));

// Log ANTES de qualquer processamento
app.use((req, res, next) => {
    if (req.method === 'POST' && req.url.includes('/external-users')) {
        console.log('🔴 [SERVER-RAW] Requisição POST recebida:', req.method, req.url);
    }
    next();
});

app.use(express.json({ limit: process.env.BODY_PARSER_LIMIT || '10mb' }));
// Sanitize desabilitado globalmente - aplicar por rota se necessário
// app.use(sanitizeInput);
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: process.env.SESSION_RESAVE === 'true',
    saveUninitialized: process.env.SESSION_SAVE_UNINITIALIZED === 'true',
    name: 'lumigente.sid',
    cookie: {
        secure: process.env.SESSION_COOKIE_SECURE === 'true',
        httpOnly: process.env.SESSION_COOKIE_HTTPONLY === 'true',
        maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE) || 8 * 60 * 60 * 1000,
        sameSite: 'strict'
    },
    rolling: true
}));

// Servir arquivos estáticos da pasta 'frontend'
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Aplicar rate limiting nas rotas da API
app.use('/api', apiLimiter);

// Carregar todas as rotas da aplicação
app.use('/api', allRoutes);

// Rota de teste
app.post('/api/test', (req, res) => {
    console.log('✅ [TEST] Rota de teste funcionando!');
    res.json({ success: true, message: 'Teste OK' });
});

// Rota principal que redireciona para o login ou para a aplicação
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/pages/index.html');
    } else {
        res.redirect('/pages/login.html');
    }
});

// Iniciar o servidor e serviços
async function startServer() {
    try {
        await getDatabasePool();

        // Iniciar o sincronizador de dados
        const sincronizador = new SincronizadorDadosExternos();
        const syncInterval = parseInt(process.env.SYNC_INTERVAL_MINUTES) || 30;
        sincronizador.startAutoSync(syncInterval);

        // Garantir que as tabelas de avaliações existam
        try {
            const { ensureAvaliacoesTablesExist } = require('./services/avaliacoesSetup');
            await ensureAvaliacoesTablesExist();
        } catch (error) {
            console.error('⚠️ Erro ao verificar tabelas de avaliações:', error.message);
        }

        // Agendar tarefas recorrentes
        scheduleJobs();
        
        // Iniciar job de notificações de pesquisas
        const { startSurveyNotificationJob, ensureSurveyNotificationLogExists } = require('./jobs/surveyNotificationJob');
        await ensureSurveyNotificationLogExists();
        startSurveyNotificationJob();

        app.listen(PORT, () => {
            console.log(`[SERVER] Acesse o sistema de forma local em: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Erro ao iniciar o servidor:', error);
        process.exit(1); // Encerra a aplicação em caso de erro na inicialização
    }
}

startServer();