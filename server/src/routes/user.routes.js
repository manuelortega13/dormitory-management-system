const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authMiddleware, roleMiddleware, exactRoleMiddleware } = require('../middleware/auth.middleware');

// GET /api/users - Get all users. Strictly the admin: the list spans every role and is not
// wing-scoped, so it is not a home dean's or the VP's to read.
router.get('/', authMiddleware, exactRoleMiddleware('admin'), userController.getAll);

// GET /api/users/parents - Parent picker for the occupants form. Wing-scoped for a dean
// inside the controller, so it does not fall back on the admin-only full user list.
router.get('/parents/list', authMiddleware, roleMiddleware('admin'), userController.getParents);

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

// GET /api/users/agents - Get all agents. Staff management is administrator-only, matching
// the Staff page's guard; roleMiddleware would have let every admin-equivalent role in.
router.get('/agents/list', authMiddleware, exactRoleMiddleware('admin'), userController.getAgents);

// Every staff write below is administrator-only, matching the Staff page's guard.
// exactRoleMiddleware is required: roleMiddleware would admit home_dean and vpsas.

// POST /api/users/agents - Create agent
router.post('/agents', authMiddleware, exactRoleMiddleware('admin'), userController.createAgent);

// PUT /api/users/agents/:id - Update agent
router.put('/agents/:id', authMiddleware, exactRoleMiddleware('admin'), userController.updateAgent);

// POST /api/users/agents/:id/reset-password - Reset a staff member's password
router.post('/agents/:id/reset-password', authMiddleware, exactRoleMiddleware('admin'), userController.resetAgentPassword);

// PATCH /api/users/agents/:id/suspend - Suspend a staff member
router.patch('/agents/:id/suspend', authMiddleware, exactRoleMiddleware('admin'), userController.suspendAgent);

// PATCH /api/users/agents/:id/reactivate - Reactivate a suspended staff member
router.patch('/agents/:id/reactivate', authMiddleware, exactRoleMiddleware('admin'), userController.reactivateAgent);

module.exports = router;
