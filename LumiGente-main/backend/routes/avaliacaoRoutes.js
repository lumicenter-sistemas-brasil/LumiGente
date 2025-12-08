const express = require('express');
const router = express.Router();
const avaliacaoController = require('../controllers/avaliacaoController');
const avaliacaoDesempenhoController = require('../controllers/avaliacaoDesempenhoController');
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

// Busca opções de uma pergunta (acesso público para responder avaliações)
router.get('/questionario/:tipo/perguntas/:id/opcoes', avaliacaoController.getOpcoesPerguntaPublico);

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

// =================================================================
// ROTAS PARA GERENCIAMENTO DE TEMPLATES DE PERGUNTAS (RH/T&D)
// =================================================================

// Busca todas as perguntas de um template específico
router.get('/templates/:tipo/perguntas', requireFeatureAccess('avaliacoes'), avaliacaoController.getTemplatePerguntas);

// Busca opções de uma pergunta específica
router.get('/templates/:tipo/perguntas/:id/opcoes', requireFeatureAccess('avaliacoes'), avaliacaoController.getOpcoesPergunta);

// Adiciona uma nova pergunta ao template
router.post('/templates/:tipo/perguntas', requireFeatureAccess('avaliacoes'), avaliacaoController.addTemplatePergunta);

// Reordena as perguntas do template
router.put('/templates/:tipo/perguntas/reordenar', requireFeatureAccess('avaliacoes'), avaliacaoController.reordenarTemplatePerguntas);

// Atualiza uma pergunta específica do template
router.put('/templates/:tipo/perguntas/:id', requireFeatureAccess('avaliacoes'), avaliacaoController.updateTemplatePergunta);

// Remove uma pergunta do template
router.delete('/templates/:tipo/perguntas/:id', requireFeatureAccess('avaliacoes'), avaliacaoController.deleteTemplatePergunta);



// =================================================================
// ROTAS PARA AVALIAÇÃO DE DESEMPENHO (NOVO MÓDULO)
// =================================================================

// Criar nova avaliação (RH)
router.post('/desempenho/criar', avaliacaoDesempenhoController.criarAvaliacao);

// Listar minhas avaliações (Colaborador/Gestor)
router.get('/desempenho/minhas', avaliacaoDesempenhoController.listarMinhasAvaliacoes);

// Listar todas as avaliações (RH)
router.get('/desempenho/todas', avaliacaoDesempenhoController.listarTodasAvaliacoes);

// Gerenciamento de Perguntas (RH)
router.post('/desempenho/perguntas', avaliacaoDesempenhoController.criarPergunta);
router.post('/desempenho/perguntas/reordenar', avaliacaoDesempenhoController.reordenarPerguntas);
router.put('/desempenho/perguntas/:id', avaliacaoDesempenhoController.atualizarPergunta);
router.delete('/desempenho/perguntas/:id', avaliacaoDesempenhoController.excluirPergunta);

// Questionário e Respostas
router.get('/desempenho/questionario', avaliacaoDesempenhoController.getQuestionario);
router.get('/desempenho/:id/respostas', avaliacaoDesempenhoController.getRespostas);

// Detalhes da avaliação
router.get('/desempenho/:id', avaliacaoDesempenhoController.getAvaliacao);

// Responder avaliação
router.post('/desempenho/:id/responder', avaliacaoDesempenhoController.responderAvaliacao);

// Calibrar avaliação (RH)
router.post('/desempenho/:id/calibrar', avaliacaoDesempenhoController.calibrarAvaliacao);

// Salvar feedback e PDI (Gestor)
router.post('/desempenho/:id/feedback-pdi', avaliacaoDesempenhoController.salvarFeedbackPDI);

// Questionário específico de uma avaliação
router.get('/desempenho/:id/questionario', avaliacaoDesempenhoController.getQuestionarioAvaliacao);

module.exports = router;