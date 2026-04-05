const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const pushService = require('../services/push.service');

// GET /api/push/vapid-public-key - Get VAPID public key (authenticated)
router.get('/vapid-public-key', authMiddleware, (req, res) => {
  const key = pushService.getVapidPublicKey();
  if (!key) {
    return res.status(404).json({ error: 'Push notifications not configured' });
  }
  res.json({ key });
});

// POST /api/push/subscribe - Save push subscription
router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    const id = await pushService.saveSubscription(req.user.id, subscription);
    res.json({ success: true, id });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// DELETE /api/push/unsubscribe - Remove push subscription
router.delete('/unsubscribe', authMiddleware, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    await pushService.removeSubscription(req.user.id, endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

module.exports = router;
