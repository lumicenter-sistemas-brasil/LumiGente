const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/authMiddleware');
const { tokenVerificationLimiter } = require('../middleware/securityMiddleware');

// Rotas para o usuário logado
router.get('/', requireAuth, userController.getCurrentUser); // Corresponde a /api/usuario
router.get('/permissions', requireAuth, userController.getUserPermissions);

router.get('/debug/hierarchy', requireAuth, userController.debugHierarchy);
router.get('/debug/permissions', requireAuth, userController.debugUserPermissions);
router.put('/profile', requireAuth, userController.updateProfile);
router.put('/password', requireAuth, userController.initiatePasswordChange);
router.post('/verify-password-change', requireAuth, tokenVerificationLimiter, userController.verifyPasswordChange);
router.post('/cancel-password-change', requireAuth, userController.cancelPasswordChange);
router.get('/cancel-password-change', userController.cancelPasswordChange);
router.post('/revert-password-change', userController.revertPasswordChange);
router.get('/revert-password-change', userController.revertPasswordChange);
router.put('/notifications', requireAuth, userController.updateNotificationPreferences);
router.put('/privacy', requireAuth, userController.updatePrivacySettings);
router.put('/email', requireAuth, userController.updateEmail);
router.post('/request-email-verification', requireAuth, userController.requestEmailVerification);
router.post('/verify-email-token', requireAuth, tokenVerificationLimiter, userController.verifyEmailToken);
router.get('/cancel-email-change', userController.cancelEmailChange);
router.post('/cancel-email-change', userController.cancelEmailChange);
router.post('/request-password-reset', requireAuth, userController.requestPasswordReset);
router.post('/verify-reset-token', requireAuth, tokenVerificationLimiter, userController.verifyResetToken);
router.post('/reset-password', requireAuth, tokenVerificationLimiter, userController.resetPassword);

// Rotas de listagem e consulta
router.get('/list', requireAuth, userController.getUsers); // Nova rota /api/users/list para evitar conflito
router.get('/feedback', requireAuth, userController.getUsersForFeedback);
router.get('/subordinates', requireAuth, userController.getSubordinates);

module.exports = router;