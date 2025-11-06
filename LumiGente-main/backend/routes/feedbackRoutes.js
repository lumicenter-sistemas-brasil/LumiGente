const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { requireAuth } = require('../middleware/authMiddleware');
const { createLimiter, auditLog } = require('../middleware/securityMiddleware');

// Aplica o middleware de autenticação para todas as rotas neste arquivo
router.use(requireAuth);

// Rotas de Feedbacks
router.get('/received', feedbackController.getReceivedFeedbacks);
router.get('/sent', feedbackController.getSentFeedbacks);
router.post('/', createLimiter, auditLog('CREATE_FEEDBACK'), feedbackController.createFeedback);

// Rotas do Chat/Thread de um feedback
router.get('/:id/info', feedbackController.getFeedbackInfo);
router.get('/:id/messages', feedbackController.getFeedbackMessages);
router.post('/:id/messages', createLimiter, auditLog('POST_MESSAGE'), feedbackController.postFeedbackMessage);

// Rotas de Reações
router.post('/messages/:messageId/react', feedbackController.reactToMessage);
router.post('/:id/react', feedbackController.reactToFeedback);

// Rota de filtros
router.get('/filters', feedbackController.getFeedbackFilters);

// Rota de métricas
router.get('/', feedbackController.getMetrics);

module.exports = router;