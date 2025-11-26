const express = require('express');
const router = express.Router();
const externalUserController = require('../controllers/externalUserController');
const { requireAuth, requireExternalUserAccess } = require('../middleware/authMiddleware');

// Todas as rotas requerem autenticação e acesso específico
router.get('/', requireAuth, requireExternalUserAccess, externalUserController.getExternalUsers);
router.get('/:id', requireAuth, requireExternalUserAccess, externalUserController.getExternalUser);
router.post('/', requireAuth, requireExternalUserAccess, externalUserController.createExternalUser);
router.put('/:id', requireAuth, requireExternalUserAccess, externalUserController.updateExternalUser);
router.delete('/:id', requireAuth, requireExternalUserAccess, externalUserController.deleteExternalUser);
router.post('/:id/activate', requireAuth, requireExternalUserAccess, externalUserController.activateExternalUser);

module.exports = router;

