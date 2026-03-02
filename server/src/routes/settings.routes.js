const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// All settings routes require authentication and admin role
router.use(authMiddleware);

// Get all settings (admin only)
router.get('/', roleMiddleware('admin'), settingsController.getAllSettings);

// Get settings by category (admin only)
router.get('/category/:category', roleMiddleware('admin'), settingsController.getSettingsByCategory);

// Get single setting value (admin only)
router.get('/:category/:key', roleMiddleware('admin'), settingsController.getSetting);

// Update multiple settings at once (admin only)
router.put('/', roleMiddleware('admin'), settingsController.updateSettings);

// Update single setting (admin only)
router.put('/:category/:key', roleMiddleware('admin'), settingsController.updateSetting);

module.exports = router;
