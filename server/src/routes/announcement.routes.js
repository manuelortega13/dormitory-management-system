const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcement.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// Public routes (for any authenticated user)
router.get('/published', announcementController.getPublished);

// Admin routes
router.get('/', roleMiddleware('admin', 'home_dean_men', 'home_dean_women', 'vpsas'), announcementController.getAll);
router.get('/stats', roleMiddleware('admin', 'home_dean_men', 'home_dean_women', 'vpsas'), announcementController.getStats);
router.get('/:id', announcementController.getById);
router.post('/', roleMiddleware('admin', 'home_dean_men', 'home_dean_women', 'vpsas'), announcementController.create);
router.put('/:id', roleMiddleware('admin', 'home_dean_men', 'home_dean_women', 'vpsas'), announcementController.update);
router.post('/:id/publish', roleMiddleware('admin', 'home_dean_men', 'home_dean_women', 'vpsas'), announcementController.publish);
router.delete('/:id', roleMiddleware('admin', 'home_dean_men', 'home_dean_women', 'vpsas'), announcementController.delete);

module.exports = router;
