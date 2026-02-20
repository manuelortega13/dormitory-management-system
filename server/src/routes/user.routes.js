const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// GET /api/users - Get all users (admin only)
router.get('/', authMiddleware, roleMiddleware('admin'), userController.getAll);

// GET /api/users/residents - Get all residents
router.get('/residents', authMiddleware, roleMiddleware('admin', 'security'), userController.getResidents);

// GET /api/users/:id - Get user by ID
router.get('/:id', authMiddleware, userController.getById);

// PUT /api/users/:id - Update user
router.put('/:id', authMiddleware, userController.update);

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', authMiddleware, roleMiddleware('admin'), userController.delete);

// GET /api/users/:id/room - Get user's room assignment
router.get('/:id/room', authMiddleware, userController.getUserRoom);

module.exports = router;
