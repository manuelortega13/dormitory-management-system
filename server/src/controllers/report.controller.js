const { pool } = require('../config/database');

const MONTHS_RETURNED = 12;
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * The last `count` calendar months ending with the current one, oldest first. The reports
 * always return a full, zero-filled series so a quiet month renders as a real zero rather
 * than vanishing from the axis.
 */
const buildMonthSeries = (count = MONTHS_RETURNED) => {
  const now = new Date();
  const months = [];

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    months.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: MONTH_NAMES[month],
      longLabel: `${MONTH_NAMES[month]} ${year}`,
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 1)),
    });
  }
  return months;
};

/** Inclusive lower bound for every query: the first day of the oldest month returned. */
const seriesStart = (months) => months[0].start;

const toDateTime = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

const numeric = (value) => (value === null || value === undefined ? 0 : Number(value));

/**
 * Which wings the viewer may see. A home dean is bound to one wing by `dean_type`, exactly
 * as leave-request.controller.js scopes their queue — the report must not leak the other
 * wing's occupants. A dean with no dean_type set, and the admin, see both.
 */
const wingsFor = (user) => {
  if (user.role === 'home_dean' && user.deanType) return [user.deanType];
  return ['male', 'female'];
};

const emptyWing = () => ({
  leaveApproved: 0,
  leaveRejected: 0,
  gatepassApproved: 0,
  gatepassRejected: 0,
  turnaroundMinutes: 0,
  turnaroundSamples: 0,
});

/**
 * GET /api/reports/decisions
 *
 * Leave requests and gatepasses that this office has approved or rejected, bucketed by
 * month and by wing. The home dean reads the dean-level columns (`admin_status` on leave
 * requests, `dean_status` on gatepasses); the VP reads the VPSAS columns and only sees the
 * decisions they personally signed.
 */
exports.getDecisions = async (req, res) => {
  try {
    const isVpsas = req.user.role === 'vpsas';
    const months = buildMonthSeries();
    const from = toDateTime(seriesStart(months));
    const wings = wingsFor(req.user);

    // Column set differs per level; the shape of the query does not.
    const leave = isVpsas
      ? { status: 'vpsas_status', at: 'vpsas_reviewed_at', by: 'vpsas_reviewed_by' }
      : { status: 'admin_status', at: 'admin_reviewed_at', by: 'admin_reviewed_by' };
    const gatepass = isVpsas
      ? { status: 'vpsas_status', at: 'vpsas_reviewed_at', by: 'vpsas_reviewed_by' }
      : { status: 'dean_status', at: 'dean_reviewed_at', by: 'dean_reviewed_by' };

    const scope = [];
    const scopeParams = [];
    if (wings.length === 1) {
      scope.push('u.gender = ?');
      scopeParams.push(wings[0]);
    }
    // "My decisions": the VP's report counts only what they signed themselves.
    const reviewerClause = isVpsas ? ' AND {t}.{by} = ?' : '';

    const bucketQuery = (table, cols) => `
      SELECT DATE_FORMAT(t.${cols.at}, '%Y-%m') AS ym,
             u.gender AS gender,
             SUM(t.${cols.status} = 'approved') AS approved,
             SUM(t.${cols.status} = 'declined') AS rejected,
             SUM(TIMESTAMPDIFF(MINUTE, t.created_at, t.${cols.at})) AS turnaround_minutes,
             COUNT(*) AS decided
      FROM ${table} t
      JOIN users u ON u.id = t.user_id
      WHERE t.${cols.status} IN ('approved', 'declined')
        AND t.${cols.at} IS NOT NULL
        AND t.${cols.at} >= ?
        AND u.gender IS NOT NULL
        ${scope.length ? `AND ${scope.join(' AND ')}` : ''}
        ${reviewerClause.replace('{t}', 't').replace('{by}', cols.by)}
      GROUP BY ym, u.gender
    `;

    const params = [from, ...scopeParams, ...(isVpsas ? [req.user.id] : [])];
    const [leaveRows] = await pool.query(bucketQuery('leave_requests', leave), params);
    const [gatepassRows] = await pool.query(bucketQuery('gatepasses', gatepass), params);

    // Zero-fill: every month x every visible wing gets a row, present in the data or not.
    const buckets = new Map();
    for (const month of months) {
      for (const wing of wings) {
        buckets.set(`${month.key}|${wing}`, emptyWing());
      }
    }

    const absorb = (rows, approvedKey, rejectedKey) => {
      for (const row of rows) {
        const bucket = buckets.get(`${row.ym}|${row.gender}`);
        if (!bucket) continue; // outside the window, or a wing this viewer cannot see
        bucket[approvedKey] += numeric(row.approved);
        bucket[rejectedKey] += numeric(row.rejected);
        bucket.turnaroundMinutes += numeric(row.turnaround_minutes);
        bucket.turnaroundSamples += numeric(row.decided);
      }
    };
    absorb(leaveRows, 'leaveApproved', 'leaveRejected');
    absorb(gatepassRows, 'gatepassApproved', 'gatepassRejected');

    const series = months.map((month) => ({
      key: month.key,
      label: month.label,
      longLabel: month.longLabel,
      wings: Object.fromEntries(
        wings.map((wing) => {
          const bucket = buckets.get(`${month.key}|${wing}`);
          return [
            wing,
            {
              leaveApproved: bucket.leaveApproved,
              leaveRejected: bucket.leaveRejected,
              gatepassApproved: bucket.gatepassApproved,
              gatepassRejected: bucket.gatepassRejected,
              // Hours, averaged over the decisions that actually landed this month.
              turnaround: bucket.turnaroundSamples
                ? bucket.turnaroundMinutes / bucket.turnaroundSamples / 60
                : 0,
            },
          ];
        }),
      ),
    }));

    const log = await fetchDecisionLog({ isVpsas, leave, gatepass, wings, userId: req.user.id });

    res.json({
      success: true,
      data: { months: series, wings, log, level: isVpsas ? 'vpsas' : 'dean' },
    });
  } catch (error) {
    console.error('getDecisions error:', error);
    res.status(500).json({ error: 'Failed to build the decisions report' });
  }
};

/** The most recent individual decisions behind the charts. */
const fetchDecisionLog = async ({ isVpsas, leave, gatepass, wings, userId }) => {
  const scope = wings.length === 1 ? 'AND u.gender = ?' : '';
  const scopeParams = wings.length === 1 ? [wings[0]] : [];
  const reviewer = isVpsas ? 'AND t.{by} = ?' : '';
  const reviewerParams = isVpsas ? [userId] : [];

  const select = (table, cols, type, reasonExpr) => `
    SELECT '${type}' AS type,
           t.id AS id,
           CONCAT(u.first_name, ' ', u.last_name) AS occupant,
           u.gender AS gender,
           COALESCE(r.room_number, '—') AS room,
           ${reasonExpr} AS reason,
           t.created_at AS filed,
           t.${cols.at} AS decided,
           t.${cols.status} AS outcome,
           COALESCE(NULLIF(t.${cols.status === 'admin_status' ? 'admin_notes' : isVpsas ? 'vpsas_notes' : 'dean_notes'}, ''), '—') AS note
    FROM ${table} t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN room_assignments ra ON ra.user_id = u.id AND ra.status = 'active'
    LEFT JOIN rooms r ON r.id = ra.room_id
    WHERE t.${cols.status} IN ('approved', 'declined')
      AND t.${cols.at} IS NOT NULL
      AND u.gender IS NOT NULL
      ${scope}
      ${reviewer.replace('{by}', cols.by)}
  `;

  const sql = `
    ${select('leave_requests', leave, 'Leave request', 't.reason')}
    UNION ALL
    ${select('gatepasses', gatepass, 'Gatepass', 't.reason')}
    ORDER BY decided DESC
    LIMIT 12
  `;

  const [rows] = await pool.query(sql, [
    ...scopeParams,
    ...reviewerParams,
    ...scopeParams,
    ...reviewerParams,
  ]);

  return rows.map((row) => ({
    reference: `${row.type === 'Gatepass' ? 'GP' : 'LR'}-${row.id}`,
    occupant: row.occupant,
    gender: row.gender,
    room: row.room,
    type: row.type,
    reason: row.reason,
    filed: row.filed,
    decided: row.decided,
    outcome: row.outcome === 'approved' ? 'Approved' : 'Rejected',
    note: row.note,
  }));
};

/**
 * GET /api/reports/payments
 *
 * Payment transactions by month: what was billed, what has been verified, what is still
 * queued for verification, what was rejected, and the channel mix.
 */
exports.getPayments = async (req, res) => {
  try {
    const months = buildMonthSeries();
    const from = toDateTime(seriesStart(months));

    const [paymentRows] = await pool.query(
      `SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS ym,
              p.status AS status,
              p.payment_method AS method,
              COUNT(*) AS n,
              SUM(p.amount) AS amount
       FROM payments p
       WHERE p.payment_date >= ?
       GROUP BY ym, p.status, p.payment_method`,
      [from],
    );

    const [billRows] = await pool.query(
      `SELECT DATE_FORMAT(b.due_date, '%Y-%m') AS ym, SUM(b.amount) AS billed
       FROM bills b
       WHERE b.due_date >= ? AND b.status <> 'cancelled'
       GROUP BY ym`,
      [from],
    );

    const empty = () => ({
      billed: 0,
      verified: 0,
      pending: 0,
      rejected: 0,
      verifiedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      methods: { gcash: 0, maya: 0, cash: 0, other: 0 },
    });
    const buckets = new Map(months.map((m) => [m.key, empty()]));

    for (const row of billRows) {
      const bucket = buckets.get(row.ym);
      if (bucket) bucket.billed = numeric(row.billed);
    }

    for (const row of paymentRows) {
      const bucket = buckets.get(row.ym);
      if (!bucket) continue;
      const amount = numeric(row.amount);
      const count = numeric(row.n);
      if (row.status === 'verified') {
        bucket.verified += amount;
        bucket.verifiedCount += count;
      } else if (row.status === 'pending') {
        bucket.pending += amount;
        bucket.pendingCount += count;
      } else if (row.status === 'rejected') {
        bucket.rejected += amount;
        bucket.rejectedCount += count;
      }
      // The channel mix covers everything submitted, whatever its verification state.
      const method = ['gcash', 'maya', 'cash'].includes(row.method) ? row.method : 'other';
      bucket.methods[method] += amount;
    }

    const series = months.map((month) => ({
      key: month.key,
      label: month.label,
      longLabel: month.longLabel,
      ...buckets.get(month.key),
    }));

    const [log] = await pool.query(
      `SELECT p.id AS id,
              p.reference_number AS reference,
              CONCAT(u.first_name, ' ', u.last_name) AS occupant,
              COALESCE(r.room_number, '—') AS room,
              p.amount AS amount,
              p.payment_method AS method,
              p.payment_date AS submitted,
              p.status AS status,
              COALESCE(CONCAT(v.first_name, ' ', v.last_name), '—') AS handledBy
       FROM payments p
       JOIN users u ON u.id = p.resident_id
       LEFT JOIN room_assignments ra ON ra.user_id = u.id AND ra.status = 'active'
       LEFT JOIN rooms r ON r.id = ra.room_id
       LEFT JOIN users v ON v.id = p.verified_by
       ORDER BY p.payment_date DESC
       LIMIT 12`,
    );

    res.json({
      success: true,
      data: {
        months: series,
        log: log.map((row) => ({
          reference: row.reference || `PMT-${row.id}`,
          occupant: row.occupant,
          room: row.room,
          amount: numeric(row.amount),
          method: row.method,
          submitted: row.submitted,
          status: row.status,
          handledBy: row.handledBy,
        })),
      },
    });
  } catch (error) {
    console.error('getPayments error:', error);
    res.status(500).json({ error: 'Failed to build the payments report' });
  }
};

/**
 * GET /api/reports/overview
 *
 * Dorm-wide occupancy, collections and leave volume for the admin.
 */
exports.getOverview = async (req, res) => {
  try {
    const months = buildMonthSeries();
    const from = toDateTime(seriesStart(months));

    const [[capacityRow]] = await pool.query(
      `SELECT COALESCE(SUM(capacity), 0) AS capacity FROM rooms WHERE status <> 'maintenance'`,
    );
    const capacity = numeric(capacityRow.capacity);

    // Occupancy is reconstructed from assignment spans: an occupant counts for a month if
    // their assignment overlapped it at all.
    const [assignments] = await pool.query(
      `SELECT ra.start_date AS startDate, ra.end_date AS endDate
       FROM room_assignments ra
       WHERE ra.status IN ('active', 'ended', 'transferred')`,
    );

    const [billRows] = await pool.query(
      `SELECT DATE_FORMAT(b.due_date, '%Y-%m') AS ym, SUM(b.amount) AS billed
       FROM bills b WHERE b.due_date >= ? AND b.status <> 'cancelled' GROUP BY ym`,
      [from],
    );
    const [paidRows] = await pool.query(
      `SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS ym, SUM(p.amount) AS collected
       FROM payments p WHERE p.payment_date >= ? AND p.status = 'verified' GROUP BY ym`,
      [from],
    );
    const [leaveRows] = await pool.query(
      `SELECT DATE_FORMAT(lr.created_at, '%Y-%m') AS ym, lr.status AS status, COUNT(*) AS n
       FROM leave_requests lr WHERE lr.created_at >= ? GROUP BY ym, lr.status`,
      [from],
    );

    const billed = new Map(billRows.map((r) => [r.ym, numeric(r.billed)]));
    const collected = new Map(paidRows.map((r) => [r.ym, numeric(r.collected)]));

    const leaveBuckets = new Map(
      months.map((m) => [m.key, { completed: 0, approved: 0, pending: 0, rejected: 0 }]),
    );
    for (const row of leaveRows) {
      const bucket = leaveBuckets.get(row.ym);
      if (!bucket) continue;
      const n = numeric(row.n);
      if (row.status === 'completed' || row.status === 'expired') bucket.completed += n;
      else if (row.status === 'declined' || row.status === 'cancelled') bucket.rejected += n;
      else if (row.status === 'approved' || row.status === 'active') bucket.approved += n;
      else bucket.pending += n;
    }

    const series = months.map((month) => {
      const occupied = assignments.filter((a) => {
        const start = new Date(a.startDate);
        const end = a.endDate ? new Date(a.endDate) : null;
        return start < month.end && (!end || end >= month.start);
      }).length;

      const leaves = leaveBuckets.get(month.key);
      return {
        key: month.key,
        label: month.label,
        longLabel: month.longLabel,
        capacity,
        occupied,
        occupancy: capacity ? (occupied / capacity) * 100 : 0,
        billed: billed.get(month.key) ?? 0,
        collected: collected.get(month.key) ?? 0,
        leaves,
        leaveTotal: leaves.completed + leaves.approved + leaves.pending + leaves.rejected,
      };
    });

    // Occupancy per floor: real rooms, real active assignments.
    const [floorRows] = await pool.query(
      // Occupants are counted in a subquery, not a join: joining assignments directly
      // multiplies each room's capacity by its assignment count and inflates the floor.
      `SELECT r.floor AS floor,
              COALESCE(SUM(r.capacity), 0) AS capacity,
              COALESCE(SUM(occ.n), 0) AS occupied
       FROM rooms r
       LEFT JOIN (
         SELECT room_id, COUNT(*) AS n
         FROM room_assignments
         WHERE status = 'active'
         GROUP BY room_id
       ) occ ON occ.room_id = r.id
       GROUP BY r.floor
       ORDER BY r.floor`,
    );

    res.json({
      success: true,
      data: {
        months: series,
        floors: floorRows.map((row) => ({
          floor: numeric(row.floor),
          capacity: numeric(row.capacity),
          occupied: numeric(row.occupied),
          occupancy: numeric(row.capacity)
            ? (numeric(row.occupied) / numeric(row.capacity)) * 100
            : 0,
        })),
      },
    });
  } catch (error) {
    console.error('getOverview error:', error);
    res.status(500).json({ error: 'Failed to build the overview report' });
  }
};
