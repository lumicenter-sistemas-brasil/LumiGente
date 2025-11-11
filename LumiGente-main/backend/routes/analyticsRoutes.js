const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const historicoController = require('../controllers/historicoController');
const { requireAuth, requireManagerAccess, requireFeatureAccess } = require('../middleware/authMiddleware');

// Aplica o middleware de autenticação para todas as rotas de analytics e gestão
router.use(requireAuth);

// =================================================================
// ROTAS PÚBLICAS (Acessíveis a todos os usuários logados)
// =================================================================

// Métricas simples para o dashboard individual
router.get('/metrics', analyticsController.getUserMetrics);

// Rankings e Leaderboards são geralmente visíveis para todos
router.get('/rankings', analyticsController.getUserRankings);
router.get('/gamification-leaderboard', analyticsController.getGamificationLeaderboard);


// =================================================================
// ROTAS DE GESTÃO E ANALYTICS (Acesso restrito a gestores, RH, T&D)
// =================================================================

// --- Rotas de Dashboard e Análise Geral ---
router.get('/dashboard', requireFeatureAccess('analytics'), analyticsController.getCompleteDashboard);
router.get('/department-analytics', requireFeatureAccess('analytics'), analyticsController.getDepartmentAnalytics);
router.get('/trends', requireFeatureAccess('analytics'), analyticsController.getTrendAnalytics);
router.get('/available-departments', requireFeatureAccess('analytics'), analyticsController.getAvailableDepartments);

// --- Rotas de Gestão de Equipe (prefixo /api/manager) ---
router.get('/team-management', requireFeatureAccess('team'), analyticsController.getTeamManagementData);
router.get('/team-metrics', requireFeatureAccess('team'), analyticsController.getTeamMetrics);
router.get('/team-status', requireFeatureAccess('team'), analyticsController.getTeamStatus);
router.get('/departments', requireFeatureAccess('team'), analyticsController.getDepartments);
router.get('/employee-info/:employeeId', requireFeatureAccess('team'), analyticsController.getEmployeeInfo);
router.get('/employee-feedbacks/:employeeId', requireFeatureAccess('team'), analyticsController.getEmployeeFeedbacks);

// --- Rotas adicionais para compatibilidade ---
router.get('/', requireFeatureAccess('analytics'), analyticsController.getComprehensiveAnalytics); // Rota raiz /api/analytics
router.get('/comprehensive', requireFeatureAccess('analytics'), analyticsController.getComprehensiveAnalytics);
router.get('/departments-list', requireFeatureAccess('analytics'), analyticsController.getDepartmentsList);
router.get('/temporal', requireFeatureAccess('analytics'), analyticsController.getTemporalAnalysis);

// --- Rotas de Histórico ---
router.get('/dados', requireFeatureAccess('historico'), analyticsController.getHistoricoDados);
router.get('/rh/objetivos', requireFeatureAccess('historico'), historicoController.getAllObjectives);
router.get('/rh/feedbacks', requireFeatureAccess('historico'), historicoController.getAllFeedbacks);
router.get('/rh/feedbacks/:id/mensagens', requireFeatureAccess('historico'), historicoController.getFeedbackMessages);
router.get('/rh/reconhecimentos', requireFeatureAccess('historico'), historicoController.getAllRecognitions);
router.get('/rh/humor', requireFeatureAccess('historico'), historicoController.getHumorEntries);

module.exports = router;