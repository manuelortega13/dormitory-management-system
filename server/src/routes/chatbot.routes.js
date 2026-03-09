const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbot.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// POST /api/chatbot/message — all authenticated users can use the chatbot
router.post('/message', chatbotController.sendMessage);

module.exports = router;
