const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Occupant's own tasks
router.get('/my', taskController.getMyTasks);

// Staff task management
router.get('/', roleMiddleware('admin', 'home_dean', 'vpsas'), taskController.getAll);
router.patch('/:id/complete', roleMiddleware('admin', 'home_dean', 'vpsas'), taskController.completeTask);

module.exports = router;
