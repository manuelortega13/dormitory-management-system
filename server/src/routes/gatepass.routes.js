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

// Disciplinary review (dean) — literal path must precede '/:id'
router.get('/disciplinary/pending', roleMiddleware('admin', 'home_dean'), gatepassController.getPendingDisciplinary);

router.get('/:id', gatepassController.getById);
router.get('/:id/extensions', gatepassController.getExtensions);

// Occupant
router.post('/', gatepassController.create);

// Admin/Home Dean create a gatepass on an occupant's behalf
router.post('/for-occupant', roleMiddleware('admin', 'home_dean'), gatepassController.createForOccupant);
router.post('/:id/cancel', gatepassController.cancel);
router.post('/:id/extend', gatepassController.extend);

// Dean disciplinary actions on a flagged gatepass
router.post('/:id/assign-task', roleMiddleware('admin', 'home_dean'), gatepassController.assignDisciplinaryTask);
router.post('/:id/waive', roleMiddleware('admin', 'home_dean'), gatepassController.waiveDisciplinary);

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
