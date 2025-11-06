const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { requireAuth } = require('../middleware/authMiddleware');

// Aplica o middleware de autenticação para TODAS as rotas de chat
router.use(requireAuth);

// =================================================================
// ROTAS DE CHAT
// =================================================================

// Rota para configurar/criar tabelas de chat se necessário
router.post('/setup-tables', chatController.setupTables);

// Rota para obter mensagens de um feedback específico
router.get('/feedbacks/:feedbackId/messages', chatController.getMessages);

// Rota para enviar uma nova mensagem no chat
router.post('/feedbacks/:feedbackId/messages', chatController.sendMessage);

// Rota para marcar mensagens como lidas
router.put('/feedbacks/:feedbackId/messages/read', chatController.markAsRead);

module.exports = router;
