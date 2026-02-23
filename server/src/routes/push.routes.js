const express = require('express');
const router = express.Router();
const pushService = require('../services/push.service');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: pushService.getVapidPublicKey() });
});

router.post('/subscribe', pushService.subscribe);
router.delete('/unsubscribe', pushService.unsubscribe);

module.exports = router;
