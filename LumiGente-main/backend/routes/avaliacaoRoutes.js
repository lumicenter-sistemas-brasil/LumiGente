const express = require('express');
const router = express.Router();
const avaliacaoController = require('../controllers/avaliacaoController');
const { requireAuth, requireManagerAccess, requireFeatureAccess } = require('../middleware/authMiddleware');

// Aplica o middleware de autenticação para todas as rotas de avaliações
router.use(requireAuth);

// =================================================================
// ROTAS PARA USUÁRIOS (Colaborador e seu Gestor)
// =================================================================

// Lista as avaliações do usuário logado (seja como avaliado ou avaliador)
router.get('/minhas', avaliacaoController.getMinhasAvaliacoes);

// Salva as respostas de uma avaliação (autoavaliação ou do gestor)
router.post('/responder', avaliacaoController.responderAvaliacao);

// Busca o questionário padrão para um tipo de avaliação (45 ou 90 dias)
router.get('/questionario/:tipo', avaliacaoController.getQuestionarioPadrao);

// Busca os detalhes e respostas de uma avaliação específica que o usuário tem acesso
router.get('/:id/respostas', avaliacaoController.getRespostasAvaliacao);


// =================================================================
// ROTAS ADMINISTRATIVAS (Acesso restrito a Gestores, RH, T&D)
// =================================================================

// Lista TODAS as avaliações do sistema
// IMPORTANTE: Esta rota deve vir ANTES de /:id para evitar conflito
router.get('/todas', requireFeatureAccess('avaliacoes'), avaliacaoController.getAllAvaliacoes);

// Busca os dados de uma avaliação específica (deve ser uma das últimas rotas para não conflitar)
router.get('/:id', avaliacaoController.getAvaliacaoById);

// Atualiza o questionário padrão de um tipo de avaliação
router.put('/questionario/:tipo', requireFeatureAccess('avaliacoes'), avaliacaoController.updateQuestionarioPadrao);

// Reabre uma avaliação que estava expirada, definindo uma nova data limite
router.post('/:id/reabrir', requireFeatureAccess('avaliacoes'), avaliacaoController.reabrirAvaliacao);

// Endpoint para acionar manualmente a verificação e criação de novas avaliações
router.post('/verificar', requireFeatureAccess('avaliacoes'), avaliacaoController.verificarAvaliacoes);


module.exports = router;