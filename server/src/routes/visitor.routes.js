const express = require('express');
const router = express.Router();
const visitorController = require('../controllers/visitor.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// GET /api/visitors - Get all visitors
router.get('/', authMiddleware, roleMiddleware('admin', 'security_guard'), visitorController.getAll);

// GET /api/visitors/current - Get current visitors (inside)
router.get('/current', authMiddleware, roleMiddleware('admin', 'security_guard'), visitorController.getCurrent);

// GET /api/visitors/:id - Get visitor by ID
router.get('/:id', authMiddleware, roleMiddleware('admin', 'security_guard'), visitorController.getById);

// POST /api/visitors - Log new visitor
router.post('/', authMiddleware, roleMiddleware('security_guard'), visitorController.create);

// POST /api/visitors/:id/checkout - Check out visitor
router.post('/:id/checkout', authMiddleware, roleMiddleware('security_guard'), visitorController.checkOut);

module.exports = router;
