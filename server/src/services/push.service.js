const webpush = require('web-push');
const { pool } = require('../config/database');

// Configure VAPID
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@pacdms.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Save a push subscription for a user.
 * Upserts by endpoint to avoid duplicates.
 */
exports.saveSubscription = async (userId, subscription) => {
  const { endpoint, keys } = subscription;

  // Check if this endpoint already exists for this user
  const [existing] = await pool.execute(
    'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
    [userId, endpoint]
  );

  if (existing.length > 0) {
    // Update keys in case they changed
    await pool.execute(
      'UPDATE push_subscriptions SET p256dh = ?, auth = ? WHERE id = ?',
      [keys.p256dh, keys.auth, existing[0].id]
    );
    return existing[0].id;
  }

  const [result] = await pool.execute(
    'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)',
    [userId, endpoint, keys.p256dh, keys.auth]
  );

  return result.insertId;
};

/**
 * Remove a push subscription by endpoint for a user.
 */
exports.removeSubscription = async (userId, endpoint) => {
  await pool.execute(
    'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
    [userId, endpoint]
  );
};

/**
 * Send a web push notification to all subscriptions for a user.
 * Non-blocking — errors are logged but never thrown.
 */
exports.sendPushToUser = async (userId, notification) => {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return; // Push not configured
  }

  try {
    const [subscriptions] = await pool.execute(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
      [userId]
    );

    if (subscriptions.length === 0) return;

    // Format payload for Angular's ngsw-worker.js
    const payload = JSON.stringify({
      notification: {
        title: notification.title || 'PAC DMS',
        body: notification.message || '',
        icon: '/api/settings/public/logo.png',
        badge: '/api/settings/public/logo.png',
        data: {
          notificationId: notification.id,
          referenceId: notification.reference_id,
          referenceType: notification.reference_type,
          onActionClick: {
            default: { operation: 'focusLastFocusedOrOpen', url: '/' },
          },
        },
      },
    });

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
      } catch (err) {
        // 404 or 410 means subscription expired — clean it up
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool
            .execute('DELETE FROM push_subscriptions WHERE id = ?', [sub.id])
            .catch(() => {});
        } else {
          console.error(`Push failed for subscription ${sub.id}:`, err.message);
        }
      }
    });

    await Promise.all(sendPromises);
  } catch (err) {
    console.error('sendPushToUser error:', err.message);
  }
};

/**
 * Get the VAPID public key.
 */
exports.getVapidPublicKey = () => {
  return process.env.VAPID_PUBLIC_KEY || null;
};
