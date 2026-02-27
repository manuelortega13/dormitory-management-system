const express = require('express');
const router = express.Router();
const parentRegistrationController = require('../controllers/parent-registration.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// All routes require admin authentication
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

// Get pending registrations count (for dashboard badge)
router.get('/pending/count', parentRegistrationController.getPendingCount);

// Get all pending parent registrations
router.get('/pending', parentRegistrationController.getPendingRegistrations);

// Get all parent registrations (with optional status filter)
router.get('/', parentRegistrationController.getAllRegistrations);

// Get single registration details
router.get('/:id', parentRegistrationController.getRegistrationById);

// Approve registration
router.post('/:id/approve', parentRegistrationController.approveRegistration);

// Decline registration
router.post('/:id/decline', parentRegistrationController.declineRegistration);

module.exports = router;
