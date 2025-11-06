const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/authMiddleware');
const { loginLimiter, auditLog, tokenVerificationLimiter } = require('../middleware/securityMiddleware');

// Rotas públicas com rate limiting
router.post('/login', loginLimiter, auditLog('LOGIN_ATTEMPT'), authController.login);
router.post('/register', loginLimiter, auditLog('REGISTER_ATTEMPT'), authController.register);
router.post('/check-cpf', loginLimiter, authController.checkCpf);

// Rotas de recuperação de senha (Esqueci minha senha - SEM autenticação)
router.post('/forgot-password', loginLimiter, auditLog('FORGOT_PASSWORD'), userController.forgotPassword);
router.post('/verify-forgot-password', tokenVerificationLimiter, auditLog('VERIFY_FORGOT_PASSWORD'), userController.verifyForgotPassword);

// Rota protegida
router.post('/logout', requireAuth, authController.logout);

module.exports = router;