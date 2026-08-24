/**
 * Shared authorization gate for parent face verification.
 *
 * Leave-request and gatepass parent approval both need the same sequence —
 * look up the enrolled face, check the attempt quota, verify, audit the result —
 * so it lives here once. Callers must already have established that this parent
 * owns the record and that it is actually awaiting their approval; this gate only
 * answers "is this really the enrolled parent in front of the camera".
 */

const { pool } = require('../config/database');
const { verifyFaces } = require('./face-verification.service');
const attempts = require('./face-attempt.service');

/**
 * @param {object} params
 * @param {import('express').Request} params.req
 * @param {number} params.parentId
 * @param {string} params.purpose - one of attempts.PURPOSE
 * @param {number|string|null} params.referenceId - the record being approved
 * @param {string} params.faceImage - base64 data URI captured at approval time
 * @returns {Promise<{ok: true} | {ok: false, status: number, body: object, headers?: object}>}
 */
async function verifyParentFace({ req, parentId, purpose, referenceId, faceImage }) {
  const ip = req.ip || req.headers['x-forwarded-for'] || null;
  const refId = referenceId == null ? null : Number.parseInt(referenceId, 10) || null;

  if (!faceImage) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Face verification is required for approval' },
    };
  }

  const [parents] = await pool.execute(
    `SELECT face_image FROM users WHERE id = ? AND role = 'parent'`,
    [parentId],
  );

  if (parents.length === 0 || !parents[0].face_image) {
    return {
      ok: false,
      status: 400,
      body: { error: 'No registered face found. Please complete face registration first.' },
    };
  }

  // Enforced before verifying: face matching is probabilistic, so unlimited
  // retries would let an attacker keep trying photos until one slips under the
  // threshold.
  const quota = await attempts.checkQuota(parentId, purpose, refId);
  if (!quota.allowed) {
    await attempts.record({
      userId: parentId,
      purpose,
      referenceId: refId,
      outcome: 'blocked',
      reason: `quota_${quota.scope}`,
      ip,
    });
    console.warn(
      `Face verification BLOCKED for parent ${parentId} on ${purpose}:${refId} (${quota.scope} quota)`,
    );
    return {
      ok: false,
      status: 429,
      headers: { 'Retry-After': String(quota.retryAfterSeconds) },
      body: {
        error:
          'Too many failed verification attempts. For security this approval is temporarily locked — please try again later, or contact the administrator.',
        retryAfterSeconds: quota.retryAfterSeconds,
      },
    };
  }

  console.log(`Starting face verification for parent ${parentId} on ${purpose}:${refId}`);
  const verification = await verifyFaces(parents[0].face_image, faceImage);

  if (!verification.match) {
    const isError = verification.code === 'engine_unavailable';
    await attempts.record({
      userId: parentId,
      purpose,
      referenceId: refId,
      outcome: isError ? 'error' : 'rejected',
      verification,
      ip,
    });
    console.log(
      `Face verification FAILED for parent ${parentId} (${verification.code}), ` +
        `distance=${verification.distance >= 0 ? verification.distance.toFixed(4) : 'n/a'}`,
    );

    // The distance is deliberately NOT returned. Handing back how close the
    // attempt was lets an attacker hill-climb toward the threshold.
    return {
      ok: false,
      status: isError ? 503 : 403,
      body: {
        error: verification.error || 'Face verification failed.',
        code: verification.code,
      },
    };
  }

  await attempts.record({
    userId: parentId,
    purpose,
    referenceId: refId,
    outcome: 'matched',
    verification,
    ip,
  });
  console.log(
    `Face verification PASSED for parent ${parentId}, distance=${verification.distance.toFixed(4)}`,
  );

  return { ok: true };
}

/** Send a gate rejection using the status/headers it chose. */
function sendGateFailure(res, gate) {
  if (gate.headers) res.set(gate.headers);
  return res.status(gate.status).json(gate.body);
}

module.exports = { verifyParentFace, sendGateFailure };
