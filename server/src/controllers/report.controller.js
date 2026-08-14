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

const makeMonth = (year, month) => ({
  key: `${year}-${String(month + 1).padStart(2, '0')}`,
  label: MONTH_NAMES[month],
  longLabel: `${MONTH_NAMES[month]} ${year}`,
  start: new Date(Date.UTC(year, month, 1)),
  end: new Date(Date.UTC(year, month + 1, 1)),
});

/** Every calendar month touched by [from, to], oldest first. */
const buildMonthSeriesBetween = (from, to) => {
  const months = [];
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  const lastYear = to.getUTCFullYear();
  const lastMonth = to.getUTCMonth();

  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(makeMonth(year, month));
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return months;
};

/** Longest custom range accepted, so a stray year cannot produce a 500-column chart. */
const MAX_RANGE_MONTHS = 36;

/**
 * Parses ?from=&to= (YYYY-MM-DD). Returns null when neither is supplied, or an `error`
 * describing why the pair is unusable. The bounds are treated as inclusive days: `to` is
 * turned into an exclusive upper bound at midnight the following day, so a request ending
 * on the 20th includes everything decided on the 20th.
 */
const parseRange = (query) => {
  const { from, to } = query;
  if (!from && !to) return null;
  if (!from || !to) return { error: 'Both from and to are required for a custom range' };

  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(from) || !pattern.test(to)) {
    return { error: 'from and to must be YYYY-MM-DD dates' };
  }

  const start = new Date(`${from}T00:00:00Z`);
  const endInclusive = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(endInclusive.getTime())) {
    return { error: 'from and to must be valid dates' };
  }
  if (start > endInclusive) return { error: 'from must not be later than to' };

  const months = buildMonthSeriesBetween(start, endInclusive);
  if (months.length > MAX_RANGE_MONTHS) {
    return { error: `A custom range may not span more than ${MAX_RANGE_MONTHS} months` };
  }

  // Exclusive upper bound: the instant after the last requested day.
  const end = new Date(endInclusive.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, months, from, to };
};

/** Inclusive lower bound for every query: the first day of the oldest month returned. */
const seriesStart = (months) => months[0].start;

const toDateTime = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

const numeric = (value) => (value === null || value === undefined ? 0 : Number(value));

/** The channels `payments.payment_method` records; anything else folds into "other". */
const PAYMENT_METHODS = ['gcash', 'maya', 'cash'];

/**
 * How many individual records the log tables carry. The charts aggregate everything in the
 * window, so the log is a sample, not a total — the response reports the full count
 * alongside it and the UI states the cap. Silently truncating a list that sits under a
 * chart invites exactly the wrong conclusion: that the two should add up.
 */
const LOG_LIMIT = 12;

/** Upper bound on an export, so a huge window cannot stream an unbounded result set. */
const EXPORT_LIMIT = 10000;

const emptyPaymentBucket = () => ({
  billed: 0,
  verified: 0,
  pending: 0,
  rejected: 0,
  verifiedCount: 0,
  pendingCount: 0,
  rejectedCount: 0,
  methods: { gcash: 0, maya: 0, cash: 0, other: 0 },
});

/**
 * Folds one `(month, status, method)` aggregate row into its bucket.
 *
 * The channel mix counts VERIFIED payments only. A rejected payment was returned, and a
 * pending one has not been checked yet — neither is confirmed money, so neither belongs in
 * a breakdown of what came in through each channel. Both are still counted in their own
 * buckets, which is what the verification-state chart and the tiles report.
 *
 * Invariant: sum(methods) === verified.
 */
const absorbPayment = (bucket, row) => {
  const amount = numeric(row.amount);
  const count = numeric(row.n);

  if (row.status === 'pending') {
    bucket.pending += amount;
    bucket.pendingCount += count;
    return bucket;
  }

  if (row.status === 'rejected') {
    bucket.rejected += amount;
    bucket.rejectedCount += count;
    return bucket;
  }

  if (row.status !== 'verified') return bucket;

  bucket.verified += amount;
  bucket.verifiedCount += count;

  const method = PAYMENT_METHODS.includes(row.method) ? row.method : 'other';
  bucket.methods[method] += amount;
  return bucket;
};

exports.__test__ = { emptyPaymentBucket, absorbPayment };

/**
 * Which wings the viewer may see. A home dean is bound to one wing by `dean_type`, exactly
 * as leave-request.controller.js scopes their queue — the report must not leak the other
 * wing's occupants. A dean with no dean_type set, and the admin, see both.
 */
const wingsFor = (user) => {
  if (user.role === 'home_dean' && user.deanType) return [user.deanType];
  return ['male', 'female'];
};

/**
 * Which columns carry a decision at this level. The home dean reads `admin_*` on leave
 * requests and `dean_*` on gatepasses; the VP reads their own VPSAS columns on both. The
 * shape of every decision query is identical — only these column names differ.
 */
const decisionColumns = (isVpsas) => ({
  leave: isVpsas
    ? { status: 'vpsas_status', at: 'vpsas_reviewed_at', by: 'vpsas_reviewed_by' }
    : { status: 'admin_status', at: 'admin_reviewed_at', by: 'admin_reviewed_by' },
  gatepass: isVpsas
    ? { status: 'vpsas_status', at: 'vpsas_reviewed_at', by: 'vpsas_reviewed_by' }
    : { status: 'dean_status', at: 'dean_reviewed_at', by: 'dean_reviewed_by' },
});

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

    const range = parseRange(req.query);
    if (range?.error) return res.status(400).json({ error: range.error });

    // A custom range spans exactly the months it touches; the default is the last 12.
    const months = range ? range.months : buildMonthSeries();
    const from = toDateTime(range ? range.start : seriesStart(months));
    // Exclusive upper bound. Without one, a range ending mid-month would still pull in the
    // rest of that month and the partial bucket would read as a full one.
    const until = toDateTime(range ? range.end : months[months.length - 1].end);
    const wings = wingsFor(req.user);

    const { leave, gatepass } = decisionColumns(isVpsas);

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
        AND t.${cols.at} < ?
        AND u.gender IS NOT NULL
        ${scope.length ? `AND ${scope.join(' AND ')}` : ''}
        ${reviewerClause.replace('{t}', 't').replace('{by}', cols.by)}
      GROUP BY ym, u.gender
    `;

    const params = [from, until, ...scopeParams, ...(isVpsas ? [req.user.id] : [])];
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

    const log = await fetchDecisionLog({
      isVpsas,
      leave,
      gatepass,
      wings,
      userId: req.user.id,
      from,
      until,
    });

    res.json({
      success: true,
      data: {
        months: series,
        wings,
        log: log.entries,
        logLimit: LOG_LIMIT,
        logTotal: log.total,
        level: isVpsas ? 'vpsas' : 'dean',
        range: range ? { from: range.from, to: range.to } : null,
      },
    });
  } catch (error) {
    console.error('getDecisions error:', error);
    res.status(500).json({ error: 'Failed to build the decisions report' });
  }
};

/**
 * The individual decisions behind the charts, as a UNION over both request types, already
 * scoped to the wings this viewer may see and — for the VP — to what they signed themselves.
 * Returned unexecuted so the on-screen log can cap it and the export can take the lot.
 */
const decisionLogQuery = ({ isVpsas, leave, gatepass, wings, userId, from, until }) => {
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
      AND t.${cols.at} >= ?
      AND t.${cols.at} < ?
      AND u.gender IS NOT NULL
      ${scope}
      ${reviewer.replace('{by}', cols.by)}
  `;

  const union = `
    ${select('leave_requests', leave, 'Leave request', 't.reason')}
    UNION ALL
    ${select('gatepasses', gatepass, 'Gatepass', 't.reason')}
  `;
  const perSelect = [from, until, ...scopeParams, ...reviewerParams];
  return { union, params: [...perSelect, ...perSelect] };
};

const decisionEntry = (row) => ({
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
});

/** The most recent individual decisions behind the charts, capped for the screen. */
const fetchDecisionLog = async (scope) => {
  const { union, params } = decisionLogQuery(scope);

  const [rows] = await pool.query(`${union} ORDER BY decided DESC LIMIT ${LOG_LIMIT}`, params);
  const [[counted]] = await pool.query(`SELECT COUNT(*) AS n FROM (${union}) counted`, params);

  return { entries: rows.map(decisionEntry), total: numeric(counted.n) };
};

/**
 * GET /api/reports/decisions/log?from=&to=
 *
 * Every decision this office made in the window, for the CSV and the printed sheet. The
 * report's own log is capped at LOG_LIMIT rows for the screen; an export that silently
 * stopped at twelve would under-report the period, so this returns the lot (bounded by
 * EXPORT_LIMIT purely as a runaway guard). Scoping is identical to /decisions: the wings
 * come from req.user, and the VP still sees only what they signed themselves.
 */
exports.getDecisionList = async (req, res) => {
  try {
    const isVpsas = req.user.role === 'vpsas';

    const range = parseRange(req.query);
    if (range?.error) return res.status(400).json({ error: range.error });

    const months = range ? range.months : buildMonthSeries();
    const from = toDateTime(range ? range.start : seriesStart(months));
    const until = toDateTime(range ? range.end : months[months.length - 1].end);

    const { leave, gatepass } = decisionColumns(isVpsas);
    const { union, params } = decisionLogQuery({
      isVpsas,
      leave,
      gatepass,
      wings: wingsFor(req.user),
      userId: req.user.id,
      from,
      until,
    });

    const [rows] = await pool.query(`${union} ORDER BY decided ASC LIMIT ${EXPORT_LIMIT}`, params);

    res.json({
      success: true,
      data: { from, until, decisions: rows.map(decisionEntry) },
    });
  } catch (error) {
    console.error('getDecisionList error:', error);
    res.status(500).json({ error: 'Failed to list decisions' });
  }
};

/**
 * GET /api/reports/payments
 *
 * Payment transactions by month: what was billed, what has been verified, what is still
 * queued for verification, what was rejected, and the channel mix. The channel mix counts
 * verified payments only — pending and rejected money is not confirmed.
 */
exports.getPayments = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (range?.error) return res.status(400).json({ error: range.error });

    const months = range ? range.months : buildMonthSeries();
    const from = toDateTime(range ? range.start : seriesStart(months));
    // Exclusive upper bound, so a range ending mid-month yields a genuinely partial bucket
    // instead of quietly pulling in the rest of that month.
    const until = toDateTime(range ? range.end : months[months.length - 1].end);

    const [paymentRows] = await pool.query(
      `SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS ym,
              p.status AS status,
              p.payment_method AS method,
              COUNT(*) AS n,
              SUM(p.amount) AS amount
       FROM payments p
       WHERE p.payment_date >= ? AND p.payment_date < ?
       GROUP BY ym, p.status, p.payment_method`,
      [from, until],
    );

    const [billRows] = await pool.query(
      `SELECT DATE_FORMAT(b.due_date, '%Y-%m') AS ym, SUM(b.amount) AS billed
       FROM bills b
       WHERE b.due_date >= ? AND b.due_date < ? AND b.status <> 'cancelled'
       GROUP BY ym`,
      [from, until],
    );

    const buckets = new Map(months.map((m) => [m.key, emptyPaymentBucket()]));

    for (const row of billRows) {
      const bucket = buckets.get(row.ym);
      if (bucket) bucket.billed = numeric(row.billed);
    }

    for (const row of paymentRows) {
      const bucket = buckets.get(row.ym);
      if (bucket) absorbPayment(bucket, row);
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
       WHERE p.payment_date >= ? AND p.payment_date < ?
       ORDER BY p.payment_date DESC
       LIMIT ${LOG_LIMIT}`,
      [from, until],
    );

    const [[logCount]] = await pool.query(
      `SELECT COUNT(*) AS n FROM payments WHERE payment_date >= ? AND payment_date < ?`,
      [from, until],
    );

    res.json({
      success: true,
      data: {
        months: series,
        range: range ? { from: range.from, to: range.to } : null,
        logLimit: LOG_LIMIT,
        logTotal: numeric(logCount.n),
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

/**
 * GET /api/reports/payments/transactions?from=&to=
 *
 * Every payment in the window, for the CSV export. The report's own log is capped at
 * LOG_LIMIT rows for the screen; an export is expected to be complete, so this returns the
 * lot (bounded by EXPORT_LIMIT purely as a runaway guard).
 */
exports.getTransactions = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (range?.error) return res.status(400).json({ error: range.error });

    const months = range ? range.months : buildMonthSeries();
    const from = toDateTime(range ? range.start : seriesStart(months));
    const until = toDateTime(range ? range.end : months[months.length - 1].end);

    const [rows] = await pool.query(
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
       WHERE p.payment_date >= ? AND p.payment_date < ?
       ORDER BY p.payment_date ASC
       LIMIT ${EXPORT_LIMIT}`,
      [from, until],
    );

    res.json({
      success: true,
      data: {
        from,
        until,
        transactions: rows.map((row) => ({
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
    console.error('getTransactions error:', error);
    res.status(500).json({ error: 'Failed to list payment transactions' });
  }
};
