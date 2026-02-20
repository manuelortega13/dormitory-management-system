const express = require('express');
const router = express.Router();
const roomController = require('../controllers/room.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// GET /api/rooms - Get all rooms
router.get('/', authMiddleware, roomController.getAll);

// GET /api/rooms/available - Get available rooms
router.get('/available', authMiddleware, roomController.getAvailable);

// GET /api/rooms/:id - Get room by ID
router.get('/:id', authMiddleware, roomController.getById);

// POST /api/rooms - Create room (admin only)
router.post('/', authMiddleware, roleMiddleware('admin'), roomController.create);

// PUT /api/rooms/:id - Update room (admin only)
router.put('/:id', authMiddleware, roleMiddleware('admin'), roomController.update);

// DELETE /api/rooms/:id - Delete room (admin only)
router.delete('/:id', authMiddleware, roleMiddleware('admin'), roomController.delete);

// POST /api/rooms/:id/assign - Assign resident to room (admin only)
router.post('/:id/assign', authMiddleware, roleMiddleware('admin'), roomController.assignResident);

// GET /api/rooms/:id/occupants - Get room occupants
router.get('/:id/occupants', authMiddleware, roomController.getOccupants);

module.exports = router;
