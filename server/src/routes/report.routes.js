const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const {
  authMiddleware,
  roleMiddleware,
  exactRoleMiddleware,
} = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Decisions: the home dean's own wing, or the VP's personally-signed escalations. Scoping
// happens inside the controller from req.user, never from a client-supplied parameter.
router.get('/decisions', exactRoleMiddleware('home_dean', 'vpsas'), reportController.getDecisions);

// Every decision in the window, for the CSV export and the printed sheet (the on-screen
// log is capped). Scoped from req.user exactly as /decisions is.
router.get(
  '/decisions/log',
  exactRoleMiddleware('home_dean', 'vpsas'),
  reportController.getDecisionList,
);

// Payments: the business officer's report; the admin can read it too.
router.get(
  '/payments',
  exactRoleMiddleware('admin', 'business_officer'),
  reportController.getPayments,
);

// Every transaction in the window, for the CSV export (the on-screen log is capped).
router.get(
  '/payments/transactions',
  exactRoleMiddleware('admin', 'business_officer'),
  reportController.getTransactions,
);

// Dorm-wide overview, admin only.
router.get('/overview', roleMiddleware('admin'), reportController.getOverview);

module.exports = router;
