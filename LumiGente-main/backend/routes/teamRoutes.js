const express = require('express');
const { requireAuth, requireManagerAccess } = require('../middleware/authMiddleware');
const teamController = require('../controllers/teamController');

const router = express.Router();

router.get('/members', requireAuth, requireManagerAccess, teamController.getTeamMembers);

module.exports = router;

