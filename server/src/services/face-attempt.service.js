/**
 * Face verification attempt log + rate limiting.
 *
 * Face matching is probabilistic, so an attacker who can retry indefinitely will
 * eventually find a photo/angle that lands under the threshold. Capping attempts
 * is what turns a single-shot ~0% false-accept rate into a durable one.
 *
 * Every attempt is also recorded with its measured distance so the threshold can
 * be tuned from real data — see `distanceReport()`.
 */

const { pool } = require('../config/database');

const PURPOSE = {
  LEAVE_REQUEST: 'leave_request_parent_approve',
  GATEPASS: 'gatepass_parent_approve',
  REGISTRATION: 'parent_registration',
};

const num = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const limits = {
  // Failed attempts allowed against one specific request before it locks.
  get perTarget() {
    return num(process.env.FACE_MAX_ATTEMPTS_PER_TARGET, 5);
  },
  // Failed attempts allowed by one parent across everything in the window —
  // stops the per-target cap being sidestepped by rotating between requests.
  get perUser() {
    return num(process.env.FACE_MAX_ATTEMPTS_PER_USER, 15);
  },
  get windowMinutes() {
    return num(process.env.FACE_ATTEMPT_WINDOW_MINUTES, 15);
  },
};

/**
 * Round to the scale of the DECIMAL columns, or null when unmeasured.
 * A distance of -1 means "never compared" (quality gate fired first).
 */
const dec = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Number(value.toFixed(4))
    : null;

/**
 * Record one attempt. Never throws — an audit-log failure must not decide
 * whether an approval succeeds, so errors are logged and swallowed.
 *
 * @param {object} attempt
 * @param {number} attempt.userId
 * @param {string} attempt.purpose - one of PURPOSE
 * @param {number|null} [attempt.referenceId]
 * @param {'matched'|'rejected'|'error'|'blocked'} attempt.outcome
 * @param {object} [attempt.verification] - result from verifyFaces()
 * @param {string} [attempt.reason] - error code when there is no verification result
 * @param {string} [attempt.ip]
 */
async function record(attempt) {
  const { userId, purpose, referenceId = null, outcome, verification, reason, ip } = attempt;
  const v = verification || {};
  const captured = v.captured || {};
  const stored = v.stored || {};

  try {
    await pool.execute(
      `INSERT INTO face_verification_attempts
       (user_id, purpose, reference_id, outcome, distance, threshold, reason,
        stored_score, captured_score, captured_face_count, captured_width_ratio,
        captured_sharpness, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        purpose,
        referenceId,
        outcome,
        dec(v.distance),
        dec(v.threshold),
        (reason || v.code || null) && String(reason || v.code).slice(0, 64),
        dec(stored.score),
        dec(captured.score),
        Number.isFinite(captured.faceCount) ? captured.faceCount : null,
        dec(captured.widthRatio),
        typeof captured.sharpness === 'number' && Number.isFinite(captured.sharpness)
          ? Number(captured.sharpness.toFixed(2))
          : null,
        ip ? String(ip).slice(0, 45) : null,
      ],
    );
  } catch (error) {
    console.error('Failed to record face verification attempt:', error.message);
  }
}

/**
 * Has this parent burned through their attempts?
 *
 * Only 'rejected' and 'error' count. 'blocked' is excluded on purpose — counting
 * refusals would make the lockout self-sustaining and never expire. A successful
 * match clears nothing, but succeeding ends the flow anyway.
 *
 * @returns {Promise<{allowed: boolean, scope?: 'target'|'user', retryAfterSeconds?: number}>}
 */
async function checkQuota(userId, purpose, referenceId = null) {
  const windowMinutes = limits.windowMinutes;

  try {
    const [rows] = await pool.execute(
      `SELECT
         SUM(reference_id <=> ? AND purpose = ?) AS target_fails,
         COUNT(*) AS user_fails,
         MIN(created_at) AS oldest
       FROM face_verification_attempts
       WHERE user_id = ?
         AND outcome IN ('rejected', 'error')
         AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [referenceId, purpose, userId, windowMinutes],
    );

    const row = rows[0] || {};
    const targetFails = Number(row.target_fails) || 0;
    const userFails = Number(row.user_fails) || 0;

    if (targetFails < limits.perTarget && userFails < limits.perUser) {
      return { allowed: true };
    }

    // Attempts age out of the window, so the caller can retry once the oldest
    // counted attempt falls outside it.
    const oldest = row.oldest ? new Date(row.oldest).getTime() : Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - oldest) / 1000));
    const retryAfterSeconds = Math.max(30, windowMinutes * 60 - elapsedSeconds);

    return {
      allowed: false,
      scope: targetFails >= limits.perTarget ? 'target' : 'user',
      retryAfterSeconds,
    };
  } catch (error) {
    // The counter table being unavailable must not become a way to approve
    // without verification, but it also should not hard-fail every approval.
    // Verification itself still runs; we just cannot rate limit this one.
    console.error('Face attempt quota check failed:', error.message);
    return { allowed: true };
  }
}

/**
 * Distance distribution for threshold tuning. Matched vs rejected percentiles
 * from real traffic are what should set FACE_MATCH_THRESHOLD.
 */
async function distanceReport(days = 30) {
  const [rows] = await pool.query(
    `SELECT outcome, COUNT(*) AS attempts,
            MIN(distance) AS min_distance,
            AVG(distance) AS avg_distance,
            MAX(distance) AS max_distance
     FROM face_verification_attempts
     WHERE distance IS NOT NULL
       AND created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY outcome`,
    [Number.parseInt(days, 10) || 30],
  );
  return rows;
}

module.exports = { record, checkQuota, distanceReport, PURPOSE, limits };
