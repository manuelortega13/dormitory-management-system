const webpush = require('web-push');
const { pool } = require('../config/database');

const VAPID_PUBLIC_KEY = 'BFOGr9laS4mnLCQkbzABgVhSMxOPDg4kirEQ6A292LD9vu9RuFx_1Qj_J-7TYqaLoyJ0Ih6fAWVp5UfJDjZe-4E';
const VAPID_PRIVATE_KEY = 'JiU7GJC9w0Qy32ZDvAKfQV2x10_YuH-3ygzpkxlKJeE';

webpush.setVapidDetails(
  'mailto:admin@dormitory.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

exports.getVapidPublicKey = () => VAPID_PUBLIC_KEY;

exports.subscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;

    if (!subscription) {
      return res.status(400).json({ error: 'Subscription is required' });
    }

    const subscriptionStr = JSON.stringify(subscription);

    await pool.execute(
      `INSERT INTO push_subscriptions (user_id, subscription, created_at) 
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE subscription = ?`,
      [userId, subscriptionStr, subscriptionStr]
    );

    res.json({ message: 'Push subscription saved' });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.execute(
      'DELETE FROM push_subscriptions WHERE user_id = ?',
      [userId]
    );

    res.json({ message: 'Push subscription removed' });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
};

exports.sendNotification = async (userId, title, message, icon = '/icons/icon-192.png', badge = '/icons/icon-72.png') => {
  try {
    console.log(`[PUSH] Attempting to send notification to user ${userId}: ${title}`);

    const [subscriptions] = await pool.execute(
      'SELECT subscription FROM push_subscriptions WHERE user_id = ?',
      [userId]
    );

    if (subscriptions.length === 0) {
      console.log(`[PUSH] No push subscription found for user ${userId} - user needs to call initPushNotifications()`);
      return;
    }

    const subscription = JSON.parse(subscriptions[0].subscription);

    const payload = JSON.stringify({
      title,
      body: message,
      icon,
      badge,
      vibrate: [100, 50, 100],
      data: { url: '/dashboard' }
    });

    await webpush.sendNotification(subscription, payload);
    console.log(`[PUSH] Notification sent successfully to user ${userId}`);
  } catch (error) {
    if (error.statusCode === 410) {
      await pool.execute(
        'DELETE FROM push_subscriptions WHERE user_id = ?',
        [userId]
      );
      console.log(`Removed expired subscription for user ${userId}`);
    } else {
      console.error('Send push notification error:', error.message);
    }
  }
};

exports.sendNotificationToMultiple = async (userIds, title, message) => {
  for (const userId of userIds) {
    await exports.sendNotification(userId, title, message);
  }
};
