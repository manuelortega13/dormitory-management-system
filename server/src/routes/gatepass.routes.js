const express = require('express');
const router = express.Router();
const gatepassController = require('../controllers/gatepass.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// All gatepass routes require authentication
router.use(authMiddleware);

// Lists / queues
router.get('/', gatepassController.getAll);
router.get('/pending-parent', roleMiddleware('parent'), gatepassController.getPendingParent);
router.get('/pending-dean', roleMiddleware('admin', 'home_dean'), gatepassController.getPendingDean);
router.get('/pending-vpsas', roleMiddleware('admin', 'vpsas'), gatepassController.getPendingVpsas);
router.get('/my-qr', gatepassController.getMyQR);

// Guard scan validation
router.get('/verify/:qrCode', roleMiddleware('admin', 'security_guard'), gatepassController.verifyQRCode);

// Extension review (dean) — literal paths must precede '/:id'
router.get('/extensions/pending-review', roleMiddleware('admin', 'home_dean'), gatepassController.getPendingExtensionReviews);
router.post('/extensions/:extId/assign-task', roleMiddleware('admin', 'home_dean'), gatepassController.reviewExtensionAssignTask);
router.post('/extensions/:extId/waive', roleMiddleware('admin', 'home_dean'), gatepassController.reviewExtensionWaive);

router.get('/:id', gatepassController.getById);
router.get('/:id/extensions', gatepassController.getExtensions);

// Occupant
router.post('/', gatepassController.create);
router.post('/:id/cancel', gatepassController.cancel);
router.post('/:id/extend', gatepassController.extend);

// Approval chain
router.post('/:id/parent-approve', roleMiddleware('parent'), gatepassController.parentApprove);
router.post('/:id/parent-decline', roleMiddleware('parent'), gatepassController.parentDecline);
router.post('/:id/dean-approve', roleMiddleware('admin', 'home_dean'), gatepassController.deanApprove);
router.post('/:id/dean-decline', roleMiddleware('admin', 'home_dean'), gatepassController.deanDecline);
router.post('/:id/vpsas-approve', roleMiddleware('admin', 'vpsas'), gatepassController.vpsasApprove);
router.post('/:id/vpsas-decline', roleMiddleware('admin', 'vpsas'), gatepassController.vpsasDecline);

// Guard exit/return
router.post('/:id/record-exit', roleMiddleware('admin', 'security_guard'), gatepassController.recordExit);
router.post('/:id/record-return', roleMiddleware('admin', 'security_guard'), gatepassController.recordReturn);

module.exports = router;
