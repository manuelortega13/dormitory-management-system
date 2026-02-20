const express = require('express');
const router = express.Router();
const leaveRequestController = require('../controllers/leave-request.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// GET /api/leave-requests - Get all leave requests (admin) or own requests (resident)
router.get('/', authMiddleware, leaveRequestController.getAll);

// GET /api/leave-requests/pending - Get pending requests (admin only)
router.get('/pending', authMiddleware, roleMiddleware('admin'), leaveRequestController.getPending);

// GET /api/leave-requests/:id - Get request by ID
router.get('/:id', authMiddleware, leaveRequestController.getById);

// POST /api/leave-requests - Create leave request
router.post('/', authMiddleware, leaveRequestController.create);

// PUT /api/leave-requests/:id - Update request (before approval)
router.put('/:id', authMiddleware, leaveRequestController.update);

// POST /api/leave-requests/:id/approve - Approve request (admin only)
router.post('/:id/approve', authMiddleware, roleMiddleware('admin'), leaveRequestController.approve);

// POST /api/leave-requests/:id/decline - Decline request (admin only)
router.post('/:id/decline', authMiddleware, roleMiddleware('admin'), leaveRequestController.decline);

// POST /api/leave-requests/:id/cancel - Cancel request
router.post('/:id/cancel', authMiddleware, leaveRequestController.cancel);

module.exports = router;
