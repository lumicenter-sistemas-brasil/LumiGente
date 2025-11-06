const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.get('/', requireAuth, notificationController.getNotifications);
router.get('/count', requireAuth, notificationController.getUnreadCount);
router.put('/:id/read', requireAuth, notificationController.markAsRead);
router.put('/read-all', requireAuth, notificationController.markAllAsRead);

module.exports = router;
