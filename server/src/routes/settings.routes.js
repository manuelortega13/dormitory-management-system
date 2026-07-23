const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// Public routes (no auth required)
router.get('/public/branding', settingsController.getPublicBranding);
router.get('/public/logo.png', settingsController.getPublicLogoImage);

// All other settings routes require authentication and admin role
router.use(authMiddleware);

// Get all settings (admin + business_officer; BO only renders Payment Settings client-side)
router.get('/', roleMiddleware('admin', 'business_officer'), settingsController.getAllSettings);

// Get settings by category (admin + business_officer)
router.get('/category/:category', roleMiddleware('admin', 'business_officer'), settingsController.getSettingsByCategory);

// Get single setting value (admin + business_officer)
router.get('/:category/:key', roleMiddleware('admin', 'business_officer'), settingsController.getSetting);

// Update multiple settings at once (admin + business_officer; BO limited to 'payments' category in controller)
router.put('/', roleMiddleware('admin', 'business_officer'), settingsController.updateSettings);

// Update single setting (admin + business_officer; BO limited to 'payments' category in controller)
router.put('/:category/:key', roleMiddleware('admin', 'business_officer'), settingsController.updateSetting);

module.exports = router;
