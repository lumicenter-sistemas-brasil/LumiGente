const express = require('express');
const router = express.Router();
// Importa do novo e único controller com os nomes de função corretos
const pesquisaController = require('../controllers/pesquisaController');
const { requireAuth, requireHRAccess, requireFeatureAccess } = require('../middleware/authMiddleware');

// =====================================================
// ROTAS DO SISTEMA UNIFICADO DE PESQUISAS (/api/pesquisas)
// =====================================================

// Rotas com acesso para todos os usuários autenticados
router.get('/', requireAuth, pesquisaController.listPesquisas);
router.get('/departamentos', requireAuth, pesquisaController.getDepartamentos);
router.get('/stats', requireAuth, pesquisaController.getPesquisaStats);
router.get('/user', requireAuth, pesquisaController.getPesquisaStats); // Alias para compatibilidade
router.get('/:id', requireAuth, pesquisaController.getPesquisaById);
router.get('/:id/my-response', requireAuth, pesquisaController.getMyResponse);
router.post('/:id/responder', requireAuth, pesquisaController.responderPesquisa);

// Rotas com acesso restrito para RH/T&D (criação e gerenciamento)
router.post('/', requireAuth, requireFeatureAccess('pesquisas'), pesquisaController.createPesquisa);
router.get('/meta/filtros', requireAuth, requireFeatureAccess('pesquisas'), pesquisaController.getMetaFiltros);
router.get('/:id/resultados', requireAuth, requireFeatureAccess('pesquisas'), pesquisaController.getPesquisaResultados);
router.post('/:id/reabrir', requireAuth, requireFeatureAccess('pesquisas'), pesquisaController.reabrirPesquisa);

module.exports = router;