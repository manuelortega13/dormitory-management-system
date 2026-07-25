const { pool } = require('../config/database');
const notificationController = require('../controllers/notification.controller');

const CHECK_INTERVAL_MS = 60 * 1000; // every minute
let timer = null;

/**
 * One pass of the overdue check: find active gatepasses whose deadline has passed and
 * that haven't been flagged yet, notify parent/dean/guard/occupant, and stamp them so
 * they aren't notified again (until the deadline moves via an extension).
 * Returns the number of gatepasses flagged (useful for tests).
 */
async function runOverdueCheckOnce() {
  try {
    const [overdue] = await pool.execute(
      `SELECT g.id, g.user_id, u.first_name, u.last_name, u.gender, u.parent_id
       FROM gatepasses g
       JOIN users u ON g.user_id = u.id
       WHERE g.status = 'active'
         AND g.deadline IS NOT NULL
         AND g.deadline < NOW()
         AND g.overdue_notified_at IS NULL`
    );

    for (const gp of overdue) {
      // Stamp first so a slow notify pass can't double-fire on the next tick
      await pool.execute('UPDATE gatepasses SET overdue_notified_at = NOW() WHERE id = ?', [gp.id]);
      await notificationController.notifyGatepassOverdue(
        gp.id,
        `${gp.first_name} ${gp.last_name}`,
        gp.gender,
        gp.parent_id,
        gp.user_id
      );
    }

    return overdue.length;
  } catch (error) {
    console.error('Gatepass overdue check error:', error.message);
    return 0;
  }
}

function startOverdueChecker() {
  if (timer) return;
  timer = setInterval(runOverdueCheckOnce, CHECK_INTERVAL_MS);
  // Don't keep the process alive solely for this timer
  if (timer.unref) timer.unref();
  console.log('⏰ Gatepass overdue checker started (every 60s)');
}

function stopOverdueChecker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { startOverdueChecker, stopOverdueChecker, runOverdueCheckOnce };
