const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authMiddleware, roleMiddleware } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// ==================== BILLS ====================

// Admin routes for bills
router.get('/bills', roleMiddleware('admin', 'home_dean_men', 'home_dean_women', 'vpsas'), paymentController.getAllBills);
router.post('/bills', roleMiddleware('admin', 'home_dean_men', 'home_dean_women'), paymentController.createBill);
router.put('/bills/:id', roleMiddleware('admin', 'home_dean_men', 'home_dean_women'), paymentController.updateBill);
router.delete('/bills/:id', roleMiddleware('admin', 'home_dean_men', 'home_dean_women'), paymentController.deleteBill);

// Resident/Parent route for viewing their bills
router.get('/my-bills', paymentController.getResidentBills);

// ==================== PAYMENTS ====================

// Admin routes for payments
router.get('/payments', roleMiddleware('admin', 'home_dean_men', 'home_dean_women', 'vpsas'), paymentController.getAllPayments);
router.put('/payments/:id/verify', roleMiddleware('admin', 'home_dean_men', 'home_dean_women'), paymentController.verifyPayment);

// Resident/Parent routes for payments
router.get('/my-payments', paymentController.getResidentPayments);
router.post('/pay', paymentController.makePayment);

// Stats (admin only)
router.get('/stats', roleMiddleware('admin', 'home_dean_men', 'home_dean_women', 'vpsas'), paymentController.getStats);

// Get residents list for dropdown
router.get('/residents', roleMiddleware('admin', 'home_dean_men', 'home_dean_women'), paymentController.getResidents);

// ==================== PAYMENT SETTINGS ====================

// Get payment settings (public - for displaying recipient info to residents/parents)
router.get('/settings', paymentController.getPaymentSettings);

// Update payment settings (admin only)
router.put('/settings', roleMiddleware('admin', 'home_dean_men', 'home_dean_women'), paymentController.updatePaymentSettings);

module.exports = router;
