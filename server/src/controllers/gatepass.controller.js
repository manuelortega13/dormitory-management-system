const crypto = require('crypto');
const { pool } = require('../config/database');
const notificationController = require('./notification.controller');
const { verifyFaces } = require('../services/face-verification.service');
const { getGatepassSettings } = require('../services/gatepass-settings.service');

// Generate a unique opaque QR token (same approach as leave requests)
const generateQRCode = () => crypto.randomBytes(32).toString('hex');

const SELECT_WITH_USER = `
  SELECT g.*,
         CONCAT(u.first_name, ' ', u.last_name) AS occupant_name,
         u.first_name, u.last_name, u.gender, u.email, u.photo_url,
         u.parent_id, u.student_resident_id
  FROM gatepasses g
  JOIN users u ON g.user_id = u.id
`;

// GET / — role-scoped list
exports.getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const { role, id: userId, deanType } = req.user;

    let query = SELECT_WITH_USER + ' WHERE 1=1';
    const params = [];

    if (role === 'resident') {
      query += ' AND g.user_id = ?';
      params.push(userId);
    } else if (role === 'parent') {
      query += ' AND u.parent_id = ?';
      params.push(userId);
    } else if (role === 'home_dean' && deanType) {
      query += ' AND u.gender = ?';
      params.push(deanType);
    }
    // admin / vpsas / security_guard: no extra scoping

    if (status) {
      query += ' AND g.status = ?';
      params.push(status);
    }

    query += ' ORDER BY g.created_at DESC';

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get gatepasses error:', error);
    res.status(500).json({ error: 'Failed to fetch gatepasses' });
  }
};

// GET /:id
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const [rows] = await pool.execute(SELECT_WITH_USER + ' WHERE g.id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Gatepass not found' });

    const gp = rows[0];
    if (role === 'resident' && gp.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (role === 'parent' && gp.parent_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ success: true, data: gp });
  } catch (error) {
    console.error('Get gatepass error:', error);
    res.status(500).json({ error: 'Failed to fetch gatepass' });
  }
};

// POST / — occupant creates a gatepass
exports.create = async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason, destination } = req.body;

    if (!reason || !destination) {
      return res.status(400).json({ error: 'Reason and destination are required' });
    }

    const [users] = await pool.execute(
      'SELECT parent_id, gender, first_name, last_name FROM users WHERE id = ?',
      [userId]
    );
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = users[0];
    const hasParent = !!user.parent_id;
    const parentStatus = hasParent ? 'pending' : 'not_required';
    const status = hasParent ? 'pending_parent' : 'pending_dean';
    const childName = `${user.first_name} ${user.last_name}`;

    const [result] = await pool.execute(
      `INSERT INTO gatepasses (user_id, reason, destination, status, parent_status)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, reason, destination, status, parentStatus]
    );
    const gatepassId = result.insertId;

    if (hasParent) {
      await notificationController.notifyParentGatepassNeeded(user.parent_id, childName, gatepassId);
    } else {
      await notificationController.notifyDeanGatepassNeeded(childName, gatepassId, user.gender);
    }

    res.status(201).json({ success: true, message: 'Gatepass request submitted', data: { id: gatepassId, status } });
  } catch (error) {
    console.error('Create gatepass error:', error);
    res.status(500).json({ error: 'Failed to create gatepass' });
  }
};

// Helper: load a gatepass joined with occupant info
async function loadGatepass(id) {
  const [rows] = await pool.execute(SELECT_WITH_USER + ' WHERE g.id = ?', [id]);
  return rows[0] || null;
}

// POST /:id/parent-approve — parent approves (face-verified)
exports.parentApprove = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, faceImage } = req.body;
    const parentId = req.user.id;

    if (!faceImage) {
      return res.status(400).json({ error: 'Face verification is required for approval' });
    }

    const [parents] = await pool.execute(
      "SELECT face_image FROM users WHERE id = ? AND role = 'parent'",
      [parentId]
    );
    if (parents.length === 0 || !parents[0].face_image) {
      return res.status(400).json({ error: 'No registered face found. Please complete face registration first.' });
    }

    const gp = await loadGatepass(id);
    if (!gp) return res.status(404).json({ error: 'Gatepass not found' });
    if (gp.parent_id !== parentId) {
      return res.status(403).json({ error: "Access denied. Not your child's gatepass." });
    }
    if (gp.status !== 'pending_parent') {
      return res.status(400).json({ error: 'Gatepass is not pending parent approval' });
    }

    const storedFace = parents[0].face_image;
    if (!storedFace.startsWith('data:image/') || !faceImage.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid face image format' });
    }

    const verification = await verifyFaces(storedFace, faceImage, 0.6);
    if (!verification.match) {
      return res.status(403).json({
        error: verification.error || 'Face verification failed. The captured face does not match your registered face.',
        distance: verification.distance,
      });
    }

    const childName = `${gp.first_name} ${gp.last_name}`;
    await pool.execute(
      `UPDATE gatepasses SET parent_status = 'approved', parent_reviewed_by = ?, parent_reviewed_at = NOW(),
       parent_notes = ?, status = 'pending_dean' WHERE id = ?`,
      [parentId, notes || null, id]
    );

    await notificationController.notifyDeanGatepassNeeded(childName, id, gp.gender);
    await notificationController.notifyOccupantGatepassProgress(
      gp.user_id, 'gatepass_parent_approved',
      'Your parent approved your gatepass. Awaiting Home Dean approval.', id
    );

    res.json({ success: true, message: 'Face verified. Parent approved. Awaiting Home Dean approval.' });
  } catch (error) {
    console.error('Parent approve gatepass error:', error);
    res.status(500).json({ error: 'Failed to approve gatepass' });
  }
};

// POST /:id/parent-decline
exports.parentDecline = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const parentId = req.user.id;

    const gp = await loadGatepass(id);
    if (!gp) return res.status(404).json({ error: 'Gatepass not found' });
    if (gp.parent_id !== parentId) return res.status(403).json({ error: 'Access denied' });
    if (gp.status !== 'pending_parent') {
      return res.status(400).json({ error: 'Gatepass is not pending parent approval' });
    }

    await pool.execute(
      `UPDATE gatepasses SET parent_status = 'declined', parent_reviewed_by = ?, parent_reviewed_at = NOW(),
       parent_notes = ?, status = 'declined' WHERE id = ?`,
      [parentId, notes || null, id]
    );
    await notificationController.notifyOccupantGatepassDeclined(gp.user_id, 'your parent', id);

    res.json({ success: true, message: 'Gatepass declined' });
  } catch (error) {
    console.error('Parent decline gatepass error:', error);
    res.status(500).json({ error: 'Failed to decline gatepass' });
  }
};

// POST /:id/dean-approve — home dean approves (second)
exports.deanApprove = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const deanId = req.user.id;

    const gp = await loadGatepass(id);
    if (!gp) return res.status(404).json({ error: 'Gatepass not found' });
    if (gp.status !== 'pending_dean') {
      return res.status(400).json({ error: 'Gatepass is not pending Home Dean approval' });
    }

    const childName = `${gp.first_name} ${gp.last_name}`;
    await pool.execute(
      `UPDATE gatepasses SET dean_status = 'approved', dean_reviewed_by = ?, dean_reviewed_at = NOW(),
       dean_notes = ?, status = 'pending_vpsas' WHERE id = ?`,
      [deanId, notes || null, id]
    );

    await notificationController.notifyVpsasGatepassNeeded(childName, id);
    await notificationController.notifyOccupantGatepassProgress(
      gp.user_id, 'gatepass_dean_approved',
      'The Home Dean approved your gatepass. Awaiting VPSAS approval.', id
    );

    res.json({ success: true, message: 'Home Dean approved. Awaiting VPSAS approval.' });
  } catch (error) {
    console.error('Dean approve gatepass error:', error);
    res.status(500).json({ error: 'Failed to approve gatepass' });
  }
};

// POST /:id/dean-decline
exports.deanDecline = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const deanId = req.user.id;

    const gp = await loadGatepass(id);
    if (!gp) return res.status(404).json({ error: 'Gatepass not found' });
    if (gp.status !== 'pending_dean') {
      return res.status(400).json({ error: 'Gatepass is not pending Home Dean approval' });
    }

    await pool.execute(
      `UPDATE gatepasses SET dean_status = 'declined', dean_reviewed_by = ?, dean_reviewed_at = NOW(),
       dean_notes = ?, status = 'declined' WHERE id = ?`,
      [deanId, notes || null, id]
    );
    await notificationController.notifyOccupantGatepassDeclined(gp.user_id, 'the Home Dean', id);

    res.json({ success: true, message: 'Gatepass declined' });
  } catch (error) {
    console.error('Dean decline gatepass error:', error);
    res.status(500).json({ error: 'Failed to decline gatepass' });
  }
};

// POST /:id/vpsas-approve — final approval, generates QR
exports.vpsasApprove = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const vpsasId = req.user.id;

    const gp = await loadGatepass(id);
    if (!gp) return res.status(404).json({ error: 'Gatepass not found' });
    if (gp.status !== 'pending_vpsas') {
      return res.status(400).json({ error: 'Gatepass is not pending VPSAS approval' });
    }

    const qrCode = generateQRCode();
    await pool.execute(
      `UPDATE gatepasses SET vpsas_status = 'approved', vpsas_reviewed_by = ?, vpsas_reviewed_at = NOW(),
       vpsas_notes = ?, status = 'approved', qr_code = ?, qr_generated_at = NOW() WHERE id = ?`,
      [vpsasId, notes || null, qrCode, id]
    );

    await notificationController.notifyOccupantGatepassApproved(gp.user_id, id);

    res.json({ success: true, message: 'Gatepass fully approved. QR code generated.', qrCode });
  } catch (error) {
    console.error('VPSAS approve gatepass error:', error);
    res.status(500).json({ error: 'Failed to approve gatepass' });
  }
};

// POST /:id/vpsas-decline
exports.vpsasDecline = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const vpsasId = req.user.id;

    const gp = await loadGatepass(id);
    if (!gp) return res.status(404).json({ error: 'Gatepass not found' });
    if (gp.status !== 'pending_vpsas') {
      return res.status(400).json({ error: 'Gatepass is not pending VPSAS approval' });
    }

    await pool.execute(
      `UPDATE gatepasses SET vpsas_status = 'declined', vpsas_reviewed_by = ?, vpsas_reviewed_at = NOW(),
       vpsas_notes = ?, status = 'declined' WHERE id = ?`,
      [vpsasId, notes || null, id]
    );
    await notificationController.notifyOccupantGatepassDeclined(gp.user_id, 'VPSAS', id);

    res.json({ success: true, message: 'Gatepass declined by VPSAS' });
  } catch (error) {
    console.error('VPSAS decline gatepass error:', error);
    res.status(500).json({ error: 'Failed to decline gatepass' });
  }
};

// GET /pending-parent
exports.getPendingParent = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      SELECT_WITH_USER + " WHERE g.status = 'pending_parent' AND u.parent_id = ? ORDER BY g.created_at DESC",
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get pending parent gatepasses error:', error);
    res.status(500).json({ error: 'Failed to fetch gatepasses' });
  }
};

// GET /pending-dean (gender-scoped for home_dean)
exports.getPendingDean = async (req, res) => {
  try {
    let query = SELECT_WITH_USER + " WHERE g.status = 'pending_dean'";
    const params = [];
    if (req.user.role === 'home_dean' && req.user.deanType) {
      query += ' AND u.gender = ?';
      params.push(req.user.deanType);
    }
    query += ' ORDER BY g.created_at DESC';
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get pending dean gatepasses error:', error);
    res.status(500).json({ error: 'Failed to fetch gatepasses' });
  }
};

// GET /pending-vpsas
exports.getPendingVpsas = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      SELECT_WITH_USER + " WHERE g.status = 'pending_vpsas' ORDER BY g.created_at DESC"
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get pending vpsas gatepasses error:', error);
    res.status(500).json({ error: 'Failed to fetch gatepasses' });
  }
};

// GET /my-qr — occupant's current approved/active gatepass
exports.getMyQR = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      SELECT_WITH_USER + " WHERE g.user_id = ? AND g.status IN ('approved', 'active') ORDER BY g.created_at DESC LIMIT 1",
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.json({ success: true, data: null, message: 'No active gatepass' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get my gatepass QR error:', error);
    res.status(500).json({ error: 'Failed to fetch gatepass' });
  }
};

// GET /verify/:qrCode — guard scan validation (returns a type discriminator for the combined scanner)
exports.verifyQRCode = async (req, res) => {
  try {
    const { qrCode } = req.params;
    const [passes] = await pool.execute(
      `SELECT g.*, CONCAT(u.first_name, ' ', u.last_name) AS occupant_name,
              u.email, u.photo_url, u.parent_id, u.student_resident_id,
              r.room_number, r.floor
       FROM gatepasses g
       JOIN users u ON g.user_id = u.id
       LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
       LEFT JOIN rooms r ON ra.room_id = r.id
       WHERE g.qr_code = ?`,
      [qrCode]
    );

    if (passes.length === 0) {
      return res.json({ data: { valid: false, type: 'gatepass', message: 'Invalid QR code' } });
    }

    const gp = passes[0];
    if (!['approved', 'active'].includes(gp.status)) {
      return res.json({ data: { valid: false, type: 'gatepass', message: `Gatepass status: ${gp.status}`, gatepass: gp } });
    }

    const action = gp.status === 'approved' ? 'exit' : 'return';
    res.json({ data: { valid: true, type: 'gatepass', action, message: 'Gatepass verified successfully', gatepass: gp } });
  } catch (error) {
    console.error('Verify gatepass QR error:', error);
    res.status(500).json({ error: 'Failed to verify gatepass' });
  }
};

// POST /:id/record-exit — guard records the occupant leaving; starts the timer
exports.recordExit = async (req, res) => {
  try {
    const { id } = req.params;
    const guardId = req.user.id;

    const gp = await loadGatepass(id);
    if (!gp) return res.status(404).json({ error: 'Gatepass not found' });
    if (gp.status !== 'approved') {
      return res.status(400).json({ error: 'Gatepass must be approved to record exit' });
    }
    if (gp.exit_time) return res.status(400).json({ error: 'Exit already recorded' });

    const { passDurationMinutes } = await getGatepassSettings();

    await pool.execute(
      `UPDATE gatepasses SET exit_time = NOW(), exit_recorded_by = ?, status = 'active',
       deadline = DATE_ADD(NOW(), INTERVAL ? MINUTE), overdue_notified_at = NULL WHERE id = ?`,
      [guardId, passDurationMinutes, id]
    );

    await pool.execute(
      `INSERT INTO check_logs (user_id, gatepass_id, type, method, recorded_by)
       VALUES (?, ?, 'check-out', 'qr_scan', ?)`,
      [gp.user_id, id, guardId]
    );

    if (gp.parent_id) {
      await notificationController.notifyParentGatepassMovement(
        gp.parent_id, `${gp.first_name} ${gp.last_name}`, 'exit', id
      );
    }

    const [updated] = await pool.execute('SELECT deadline FROM gatepasses WHERE id = ?', [id]);
    res.json({
      success: true,
      message: `Exit recorded. Gatepass valid for ${passDurationMinutes} minutes.`,
      deadline: updated[0].deadline,
    });
  } catch (error) {
    console.error('Record gatepass exit error:', error);
    res.status(500).json({ error: 'Failed to record exit' });
  }
};

// POST /:id/record-return — guard records the occupant returning
exports.recordReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const guardId = req.user.id;

    const gp = await loadGatepass(id);
    if (!gp) return res.status(404).json({ error: 'Gatepass not found' });
    if (gp.status !== 'active') {
      return res.status(400).json({ error: 'Occupant has not exited yet' });
    }
    if (gp.return_time) return res.status(400).json({ error: 'Return already recorded' });

    await pool.execute(
      `UPDATE gatepasses SET return_time = NOW(), return_recorded_by = ?, status = 'completed' WHERE id = ?`,
      [guardId, id]
    );

    await pool.execute(
      `INSERT INTO check_logs (user_id, gatepass_id, type, method, recorded_by)
       VALUES (?, ?, 'check-in', 'qr_scan', ?)`,
      [gp.user_id, id, guardId]
    );

    if (gp.parent_id) {
      await notificationController.notifyParentGatepassMovement(
        gp.parent_id, `${gp.first_name} ${gp.last_name}`, 'return', id
      );
    }

    res.json({ success: true, message: 'Return recorded. Gatepass completed.' });
  } catch (error) {
    console.error('Record gatepass return error:', error);
    res.status(500).json({ error: 'Failed to record return' });
  }
};

// POST /:id/cancel — occupant/admin cancels before it becomes active
exports.cancel = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const gp = await loadGatepass(id);
    if (!gp) return res.status(404).json({ error: 'Gatepass not found' });
    if (gp.user_id !== userId && role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (['active', 'completed'].includes(gp.status)) {
      return res.status(400).json({ error: 'Cannot cancel an active or completed gatepass' });
    }

    await pool.execute("UPDATE gatepasses SET status = 'cancelled' WHERE id = ?", [id]);
    res.json({ success: true, message: 'Gatepass cancelled' });
  } catch (error) {
    console.error('Cancel gatepass error:', error);
    res.status(500).json({ error: 'Failed to cancel gatepass' });
  }
};

// POST /:id/extend — occupant extends an active gatepass (+ configurable minutes)
exports.extend = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, image } = req.body;
    const userId = req.user.id;

    if (!reason || !image) {
      return res.status(400).json({ error: 'A reason and a supporting image are required' });
    }

    const gp = await loadGatepass(id);
    if (!gp) return res.status(404).json({ error: 'Gatepass not found' });
    if (gp.user_id !== userId) return res.status(403).json({ error: 'Access denied' });
    if (gp.status !== 'active') {
      return res.status(400).json({ error: 'Only an active gatepass can be extended' });
    }

    const { extensionDurationMinutes, maxExtensions } = await getGatepassSettings();

    const [[countRow]] = await pool.execute(
      'SELECT COUNT(*) AS n FROM gatepass_extensions WHERE gatepass_id = ?',
      [id]
    );
    if (countRow.n >= maxExtensions) {
      return res.status(400).json({ error: `Maximum of ${maxExtensions} extensions reached` });
    }

    // New deadline = later of (current deadline, now) + extension length
    const [[dl]] = await pool.execute(
      'SELECT DATE_ADD(GREATEST(COALESCE(deadline, NOW()), NOW()), INTERVAL ? MINUTE) AS new_deadline FROM gatepasses WHERE id = ?',
      [extensionDurationMinutes, id]
    );
    const newDeadline = dl.new_deadline;

    await pool.execute(
      `INSERT INTO gatepass_extensions (gatepass_id, requested_by, reason, image, new_deadline)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, reason, image, newDeadline]
    );

    await pool.execute(
      'UPDATE gatepasses SET deadline = ?, overdue_notified_at = NULL WHERE id = ?',
      [newDeadline, id]
    );

    await notificationController.notifyGatepassExtended(
      id, `${gp.first_name} ${gp.last_name}`, gp.gender, gp.parent_id
    );

    res.json({
      success: true,
      message: 'Gatepass extended',
      deadline: newDeadline,
      extensions_used: countRow.n + 1,
      extensions_remaining: maxExtensions - (countRow.n + 1),
    });
  } catch (error) {
    console.error('Extend gatepass error:', error);
    res.status(500).json({ error: 'Failed to extend gatepass' });
  }
};

// GET /:id/extensions — list a gatepass's extensions (for detail views / dean review)
exports.getExtensions = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT e.*, CONCAT(rb.first_name, ' ', rb.last_name) AS reviewer_name
       FROM gatepass_extensions e
       LEFT JOIN users rb ON e.reviewed_by = rb.id
       WHERE e.gatepass_id = ? ORDER BY e.created_at ASC`,
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get gatepass extensions error:', error);
    res.status(500).json({ error: 'Failed to fetch extensions' });
  }
};

// GET /extensions/pending-review — extensions awaiting dean review (occupant returned)
exports.getPendingExtensionReviews = async (req, res) => {
  try {
    let query = `
      SELECT e.*, g.reason AS gatepass_reason, g.destination, g.status AS gatepass_status,
             CONCAT(u.first_name, ' ', u.last_name) AS occupant_name, u.student_resident_id, u.gender
      FROM gatepass_extensions e
      JOIN gatepasses g ON e.gatepass_id = g.id
      JOIN users u ON g.user_id = u.id
      WHERE e.review_status = 'pending_review' AND g.status = 'completed'
    `;
    const params = [];
    if (req.user.role === 'home_dean' && req.user.deanType) {
      query += ' AND u.gender = ?';
      params.push(req.user.deanType);
    }
    query += ' ORDER BY e.created_at DESC';
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get pending extension reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch extension reviews' });
  }
};

// Internal: load an extension joined with its gatepass + occupant
async function loadExtension(extensionId) {
  const [rows] = await pool.execute(
    `SELECT e.*, g.user_id AS occupant_id, CONCAT(u.first_name, ' ', u.last_name) AS occupant_name
     FROM gatepass_extensions e
     JOIN gatepasses g ON e.gatepass_id = g.id
     JOIN users u ON g.user_id = u.id
     WHERE e.id = ?`,
    [extensionId]
  );
  return rows[0] || null;
}

// POST /extensions/:extId/assign-task — dean assigns a disciplinary task for an extension
exports.reviewExtensionAssignTask = async (req, res) => {
  try {
    const { extId } = req.params;
    const { title, description, due_date } = req.body;
    const deanId = req.user.id;

    if (!title) return res.status(400).json({ error: 'A task title is required' });

    const ext = await loadExtension(extId);
    if (!ext) return res.status(404).json({ error: 'Extension not found' });
    if (ext.review_status !== 'pending_review') {
      return res.status(400).json({ error: 'This extension has already been reviewed' });
    }

    const [result] = await pool.execute(
      `INSERT INTO tasks (user_id, assigned_by, gatepass_id, extension_id, title, description, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ext.occupant_id, deanId, ext.gatepass_id, ext.id, title, description || null, due_date || null]
    );

    await pool.execute(
      `UPDATE gatepass_extensions SET review_status = 'task_assigned', reviewed_by = ?, reviewed_at = NOW(),
       review_notes = ? WHERE id = ?`,
      [deanId, description || null, extId]
    );

    await notificationController.notifyOccupantTaskAssigned(ext.occupant_id, ext.gatepass_id, title);

    res.status(201).json({ success: true, message: 'Disciplinary task assigned', data: { task_id: result.insertId } });
  } catch (error) {
    console.error('Assign extension task error:', error);
    res.status(500).json({ error: 'Failed to assign task' });
  }
};

// POST /extensions/:extId/waive — dean waives disciplinary action for an extension
exports.reviewExtensionWaive = async (req, res) => {
  try {
    const { extId } = req.params;
    const { notes } = req.body;
    const deanId = req.user.id;

    const ext = await loadExtension(extId);
    if (!ext) return res.status(404).json({ error: 'Extension not found' });
    if (ext.review_status !== 'pending_review') {
      return res.status(400).json({ error: 'This extension has already been reviewed' });
    }

    await pool.execute(
      `UPDATE gatepass_extensions SET review_status = 'waived', reviewed_by = ?, reviewed_at = NOW(),
       review_notes = ? WHERE id = ?`,
      [deanId, notes || null, extId]
    );

    res.json({ success: true, message: 'Extension waived — no disciplinary action' });
  } catch (error) {
    console.error('Waive extension error:', error);
    res.status(500).json({ error: 'Failed to waive extension' });
  }
};
