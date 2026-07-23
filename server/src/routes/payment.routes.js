const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authMiddleware, exactRoleMiddleware } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// The Payments area is restricted to admin + business_officer only. exactRoleMiddleware
// is used (instead of roleMiddleware) so home_dean/vpsas are NOT admitted here.
const paymentsStaff = exactRoleMiddleware('admin', 'business_officer');

// ==================== BILLS ====================

// Admin routes for bills
router.get('/bills', paymentsStaff, paymentController.getAllBills);
router.post('/bills', paymentsStaff, paymentController.createBill);
router.put('/bills/:id', paymentsStaff, paymentController.updateBill);
router.delete('/bills/:id', paymentsStaff, paymentController.deleteBill);

// Resident/Parent route for viewing their bills
router.get('/my-bills', paymentController.getResidentBills);

// ==================== PAYMENTS ====================

// Admin routes for payments
router.get('/payments', paymentsStaff, paymentController.getAllPayments);
router.put('/payments/:id/verify', paymentsStaff, paymentController.verifyPayment);

// Resident/Parent routes for payments
router.get('/my-payments', paymentController.getResidentPayments);
router.post('/pay', paymentController.makePayment);

// Stats (admin only)
router.get('/stats', paymentsStaff, paymentController.getStats);

// Get residents list for dropdown
router.get('/residents', paymentsStaff, paymentController.getResidents);

// ==================== PAYMENT SETTINGS ====================

// Get payment settings (public - for displaying recipient info to residents/parents)
router.get('/settings', paymentController.getPaymentSettings);

// Update payment settings (admin + business_officer only)
router.put('/settings', paymentsStaff, paymentController.updatePaymentSettings);

module.exports = router;
