const express = require('express');
const router = express.Router();
const leaveRequestController = require('../controllers/leave-request.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// GET /api/leave-requests - Get all leave requests (filtered by role)
router.get('/', authMiddleware, leaveRequestController.getAll);

// GET /api/leave-requests/pending-admin - Get requests pending dean/admin approval
router.get('/pending-admin', authMiddleware, roleMiddleware('admin', 'home_dean'), leaveRequestController.getPendingAdmin);

// GET /api/leave-requests/pending-parent - Get requests pending parent approval
router.get('/pending-parent', authMiddleware, roleMiddleware('parent'), leaveRequestController.getPendingParent);

// GET /api/leave-requests/pending-vpsas - Get requests pending VPSAS approval
router.get('/pending-vpsas', authMiddleware, roleMiddleware('admin', 'vpsas'), leaveRequestController.getPendingVpsas);

// GET /api/leave-requests/my-qr - Get current user's active QR code
router.get('/my-qr', authMiddleware, leaveRequestController.getMyQRCode);

// GET /api/leave-requests/verify/:qrCode - Verify QR code (security guard)
router.get('/verify/:qrCode', authMiddleware, roleMiddleware('admin', 'security_guard'), leaveRequestController.verifyQRCode);

// GET /api/leave-requests/:id - Get request by ID
router.get('/:id', authMiddleware, leaveRequestController.getById);

// POST /api/leave-requests - Create leave request
router.post('/', authMiddleware, leaveRequestController.create);

// PUT /api/leave-requests/:id - Update request (before admin approval)
router.put('/:id', authMiddleware, leaveRequestController.update);

// POST /api/leave-requests/:id/admin-approve - Home Dean/Admin approves request
router.post('/:id/admin-approve', authMiddleware, roleMiddleware('admin', 'home_dean'), leaveRequestController.adminApprove);

// POST /api/leave-requests/:id/admin-decline - Home Dean/Admin declines request
router.post('/:id/admin-decline', authMiddleware, roleMiddleware('admin', 'home_dean'), leaveRequestController.adminDecline);

// POST /api/leave-requests/:id/parent-approve - Parent approves request
router.post('/:id/parent-approve', authMiddleware, roleMiddleware('parent'), leaveRequestController.parentApprove);

// POST /api/leave-requests/:id/parent-decline - Parent declines request
router.post('/:id/parent-decline', authMiddleware, roleMiddleware('parent'), leaveRequestController.parentDecline);

// POST /api/leave-requests/:id/vpsas-approve - VPSAS approves request (final approval)
router.post('/:id/vpsas-approve', authMiddleware, roleMiddleware('admin', 'vpsas'), leaveRequestController.vpsasApprove);

// POST /api/leave-requests/:id/vpsas-decline - VPSAS declines request
router.post('/:id/vpsas-decline', authMiddleware, roleMiddleware('admin', 'vpsas'), leaveRequestController.vpsasDecline);

// POST /api/leave-requests/:id/record-exit - Security records resident exit
router.post('/:id/record-exit', authMiddleware, roleMiddleware('admin', 'security_guard'), leaveRequestController.recordExit);

// POST /api/leave-requests/:id/record-return - Security records resident return
router.post('/:id/record-return', authMiddleware, roleMiddleware('admin', 'security_guard'), leaveRequestController.recordReturn);

// POST /api/leave-requests/:id/cancel - Cancel request
router.post('/:id/cancel', authMiddleware, leaveRequestController.cancel);

module.exports = router;
