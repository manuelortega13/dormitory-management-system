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

// Payments: the business officer's report; the admin can read it too.
router.get(
  '/payments',
  exactRoleMiddleware('admin', 'business_officer'),
  reportController.getPayments,
);

// Dorm-wide overview, admin only.
router.get('/overview', roleMiddleware('admin'), reportController.getOverview);

module.exports = router;
