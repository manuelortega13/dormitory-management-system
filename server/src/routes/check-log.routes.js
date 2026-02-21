const express = require('express');
const router = express.Router();
const checkLogController = require('../controllers/check-log.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// GET /api/check-logs - Get all check logs
router.get('/', authMiddleware, roleMiddleware('admin', 'security_guard'), checkLogController.getAll);

// GET /api/check-logs/today - Get today's logs
router.get('/today', authMiddleware, roleMiddleware('admin', 'security_guard'), checkLogController.getToday);

// GET /api/check-logs/children - Get logs for parent's children
router.get('/children', authMiddleware, roleMiddleware('parent'), checkLogController.getChildrenLogs);

// GET /api/check-logs/user/:userId - Get logs for specific user
router.get('/user/:userId', authMiddleware, checkLogController.getByUser);

// POST /api/check-logs/check-in - Record check-in
router.post('/check-in', authMiddleware, roleMiddleware('security_guard'), checkLogController.checkIn);

// POST /api/check-logs/check-out - Record check-out
router.post('/check-out', authMiddleware, roleMiddleware('security_guard'), checkLogController.checkOut);

// POST /api/check-logs/scan - Process QR scan
router.post('/scan', authMiddleware, roleMiddleware('security_guard'), checkLogController.processScan);

module.exports = router;
