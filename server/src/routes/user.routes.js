const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// GET /api/users - Get all users (admin only)
router.get('/', authMiddleware, roleMiddleware('admin'), userController.getAll);

// GET /api/users/residents - Get all residents
router.get('/residents', authMiddleware, roleMiddleware('admin', 'security_guard'), userController.getResidents);

// GET /api/users/:id - Get user by ID
router.get('/:id', authMiddleware, userController.getById);

// PUT /api/users/:id - Update user
router.put('/:id', authMiddleware, userController.update);

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', authMiddleware, roleMiddleware('admin'), userController.delete);

// PATCH /api/users/:id/suspend - Suspend a resident (admin only)
router.patch('/:id/suspend', authMiddleware, roleMiddleware('admin'), userController.suspendResident);

// PATCH /api/users/:id/reactivate - Reactivate a suspended resident (admin only)
router.patch('/:id/reactivate', authMiddleware, roleMiddleware('admin'), userController.reactivateResident);

// GET /api/users/:id/room - Get user's room assignment
router.get('/:id/room', authMiddleware, userController.getUserRoom);

// GET /api/users/agents - Get all agents (admin only)
router.get('/agents/list', authMiddleware, roleMiddleware('admin'), userController.getAgents);

// POST /api/users/agents - Create agent (admin only)
router.post('/agents', authMiddleware, roleMiddleware('admin'), userController.createAgent);

// PUT /api/users/agents/:id - Update agent (admin only)
router.put('/agents/:id', authMiddleware, roleMiddleware('admin'), userController.updateAgent);

module.exports = router;
