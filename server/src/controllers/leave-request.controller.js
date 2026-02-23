const crypto = require('crypto');
const { pool } = require('../config/database');
const notificationController = require('./notification.controller');

// Generate unique QR code
const generateQRCode = () => {
  return crypto.randomBytes(32).toString('hex');
};

exports.getAll = async (req, res) => {
  try {
    const { status, adminStatus, parentStatus, limit } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = `
      SELECT lr.*, 
             u.first_name, u.last_name,
             CONCAT(u.first_name, ' ', u.last_name) as user_name,
             u.email as user_email, u.phone as user_phone,
             r.room_number,
             admin.first_name as admin_first_name, admin.last_name as admin_last_name,
             parent.first_name as parent_first_name, parent.last_name as parent_last_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
      LEFT JOIN rooms r ON ra.room_id = r.id
      LEFT JOIN users admin ON lr.admin_reviewed_by = admin.id
      LEFT JOIN users parent ON u.parent_id = parent.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based filtering
    if (userRole === 'resident') {
      query += ' AND lr.user_id = ?';
      params.push(userId);
    } else if (userRole === 'parent') {
      // Parents see requests from their children
      query += ' AND u.parent_id = ?';
      params.push(userId);
    }
    // Admin and security can see all

    if (status) {
      query += ' AND lr.status = ?';
      params.push(status);
    }

    if (adminStatus) {
      query += ' AND lr.admin_status = ?';
      params.push(adminStatus);
    }

    if (parentStatus) {
      query += ' AND lr.parent_status = ?';
      params.push(parentStatus);
    }

    query += ' ORDER BY lr.created_at DESC';

    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
    }

    const [requests] = await pool.execute(query, params);

    res.json({ data: requests });
  } catch (error) {
    console.error('Get leave requests error:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
};

exports.getPendingAdmin = async (req, res) => {
  try {
    const [requests] = await pool.execute(
      `SELECT lr.*, 
              CONCAT(u.first_name, ' ', u.last_name) as user_name,
              u.email as user_email, 
              r.room_number
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
       LEFT JOIN rooms r ON ra.room_id = r.id
       WHERE lr.status = 'pending_admin'
       ORDER BY lr.created_at ASC`
    );

    res.json({ data: requests });
  } catch (error) {
    console.error('Get pending admin requests error:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
};

exports.getPendingParent = async (req, res) => {
  try {
    const parentId = req.user.id;

    const [requests] = await pool.execute(
      `SELECT lr.*, 
              CONCAT(u.first_name, ' ', u.last_name) as user_name,
              u.email, r.room_number
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
       LEFT JOIN rooms r ON ra.room_id = r.id
       WHERE lr.status = 'pending_parent' AND u.parent_id = ?
       ORDER BY lr.created_at ASC`,
      [parentId]
    );

    res.json({ data: requests });
  } catch (error) {
    console.error('Get pending parent requests error:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [requests] = await pool.execute(
      `SELECT lr.*, 
              u.first_name, u.last_name, u.email, u.phone as user_phone, u.parent_id,
              r.room_number,
              admin.first_name as admin_first_name, admin.last_name as admin_last_name
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
       LEFT JOIN rooms r ON ra.room_id = r.id
       LEFT JOIN users admin ON lr.admin_reviewed_by = admin.id
       WHERE lr.id = ?`,
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const request = requests[0];

    // Check access based on role
    const { role, id: userId } = req.user;
    if (role === 'resident' && request.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (role === 'parent' && request.parent_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ data: request });
  } catch (error) {
    console.error('Get leave request error:', error);
    res.status(500).json({ error: 'Failed to fetch leave request' });
  }
};

exports.create = async (req, res) => {
  try {
    const { 
      leaveType, startDate, endDate, reason, destination, 
      emergencyContact, emergencyPhone 
    } = req.body;
    const userId = req.user.id;

    // Convert ISO dates to MySQL datetime format
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.toISOString().slice(0, 19).replace('T', ' ');
    };

    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);

    // Check if user has a parent linked
    const [users] = await pool.execute(
      'SELECT parent_id FROM users WHERE id = ?',
      [userId]
    );
    
    const hasParent = users[0]?.parent_id != null;
    const parentStatus = hasParent ? 'pending' : 'not_required';

    const [result] = await pool.execute(
      `INSERT INTO leave_requests 
       (user_id, leave_type, start_date, end_date, reason, destination, 
        emergency_contact, emergency_phone, status, admin_status, parent_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_admin', 'pending', ?)`,
      [userId, leaveType, formattedStartDate, formattedEndDate, reason, destination, 
       emergencyContact || null, emergencyPhone || null, parentStatus]
    );

    // Get resident name for notification
    const [residentInfo] = await pool.execute(
      'SELECT first_name, last_name FROM users WHERE id = ?',
      [userId]
    );
    const residentName = `${residentInfo[0].first_name} ${residentInfo[0].last_name}`;

    // Notify all admins/deans about new leave request
    await notificationController.notifyAdminsNewRequest(residentName, result.insertId);

    // Fetch the created request
    const [created] = await pool.execute(
      'SELECT * FROM leave_requests WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      message: 'Leave request submitted successfully. Awaiting admin approval.',
      data: created[0]
    });
  } catch (error) {
    console.error('Create leave request error:', error);
    res.status(500).json({ error: 'Failed to create leave request' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { leaveType, startDate, endDate, reason, destination, emergencyContact, emergencyPhone } = req.body;

    // Convert ISO dates to MySQL datetime format
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.toISOString().slice(0, 19).replace('T', ' ');
    };

    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);

    // Check if request exists and is still pending admin
    const [existing] = await pool.execute(
      'SELECT * FROM leave_requests WHERE id = ? AND status = "pending_admin"',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    // Only owner can update
    if (existing[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.execute(
      `UPDATE leave_requests SET 
       leave_type = ?, start_date = ?, end_date = ?, reason = ?, 
       destination = ?, emergency_contact = ?, emergency_phone = ?
       WHERE id = ?`,
      [leaveType, formattedStartDate, formattedEndDate, reason, destination, emergencyContact || null, emergencyPhone || null, id]
    );

    res.json({ message: 'Leave request updated successfully' });
  } catch (error) {
    console.error('Update leave request error:', error);
    res.status(500).json({ error: 'Failed to update leave request' });
  }
};

exports.adminApprove = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;

    // Get current request with user info
    const [requests] = await pool.execute(
      `SELECT lr.*, u.parent_id, u.first_name, u.last_name FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       WHERE lr.id = ?`,
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const request = requests[0];
    
    if (request.status !== 'pending_admin') {
      return res.status(400).json({ error: 'Request is not pending admin approval' });
    }

    const hasParent = request.parent_id != null;
    let newStatus, qrCode = null, qrGeneratedAt = null;

    if (hasParent && request.parent_status === 'pending') {
      // Needs parent approval next
      newStatus = 'pending_parent';
      
      // Notify parent about approval needed
      const childName = `${request.first_name} ${request.last_name}`;
      await notificationController.notifyParentApprovalNeeded(request.parent_id, childName, id);
    } else {
      // No parent or parent already approved - generate QR
      newStatus = 'approved';
      qrCode = generateQRCode();
      qrGeneratedAt = new Date();
      
      // Notify resident about full approval
      await notificationController.notifyResidentRequestStatus(request.user_id, 'approved', 'admin', id);
    }

    await pool.execute(
      `UPDATE leave_requests SET 
       admin_status = 'approved', 
       admin_reviewed_by = ?, 
       admin_reviewed_at = NOW(), 
       admin_notes = ?,
       status = ?,
       qr_code = ?,
       qr_generated_at = ?
       WHERE id = ?`,
      [adminId, notes || null, newStatus, qrCode, qrGeneratedAt, id]
    );

    res.json({ 
      message: hasParent && request.parent_status === 'pending' 
        ? 'Admin approved. Awaiting parent approval.' 
        : 'Leave request fully approved. QR code generated.',
      qrCode: qrCode
    });
  } catch (error) {
    console.error('Admin approve request error:', error);
    res.status(500).json({ error: 'Failed to approve leave request' });
  }
};

exports.adminDecline = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Get request user_id for notification
    const [requests] = await pool.execute('SELECT user_id FROM leave_requests WHERE id = ?', [id]);
    
    await pool.execute(
      `UPDATE leave_requests SET 
       admin_status = 'declined', 
       admin_reviewed_by = ?, 
       admin_reviewed_at = NOW(), 
       admin_notes = ?,
       status = 'declined'
       WHERE id = ?`,
      [req.user.id, notes || null, id]
    );

    // Notify resident about decline
    if (requests.length > 0) {
      await notificationController.notifyResidentRequestStatus(requests[0].user_id, 'declined', 'admin', id);
    }

    res.json({ message: 'Leave request declined' });
  } catch (error) {
    console.error('Admin decline request error:', error);
    res.status(500).json({ error: 'Failed to decline leave request' });
  }
};

exports.parentApprove = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const parentId = req.user.id;

    // Verify this parent owns this request's resident
    const [requests] = await pool.execute(
      `SELECT lr.*, u.parent_id FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       WHERE lr.id = ?`,
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const request = requests[0];

    if (request.parent_id !== parentId) {
      return res.status(403).json({ error: 'Access denied. Not your child\'s request.' });
    }

    if (request.status !== 'pending_parent') {
      return res.status(400).json({ error: 'Request is not pending parent approval' });
    }

    // Generate QR code since both approvals are now complete
    const qrCode = generateQRCode();

    await pool.execute(
      `UPDATE leave_requests SET 
       parent_status = 'approved', 
       parent_reviewed_at = NOW(), 
       parent_notes = ?,
       status = 'approved',
       qr_code = ?,
       qr_generated_at = NOW()
       WHERE id = ?`,
      [notes || null, qrCode, id]
    );

    // Notify resident about parent approval
    await notificationController.notifyResidentRequestStatus(request.user_id, 'approved', 'parent', id);

    res.json({ 
      message: 'Leave request approved by parent. QR code generated.',
      qrCode: qrCode
    });
  } catch (error) {
    console.error('Parent approve request error:', error);
    res.status(500).json({ error: 'Failed to approve leave request' });
  }
};

exports.parentDecline = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const parentId = req.user.id;

    // Verify ownership
    const [requests] = await pool.execute(
      `SELECT lr.*, u.parent_id FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       WHERE lr.id = ?`,
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    if (requests[0].parent_id !== parentId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.execute(
      `UPDATE leave_requests SET 
       parent_status = 'declined', 
       parent_reviewed_at = NOW(), 
       parent_notes = ?,
       status = 'declined'
       WHERE id = ?`,
      [notes || null, id]
    );

    // Notify resident about parent decline
    await notificationController.notifyResidentRequestStatus(requests[0].user_id, 'declined', 'parent', id);

    res.json({ message: 'Leave request declined by parent' });
  } catch (error) {
    console.error('Parent decline request error:', error);
    res.status(500).json({ error: 'Failed to decline leave request' });
  }
};

exports.verifyQRCode = async (req, res) => {
  try {
    const { qrCode } = req.params;

    const [requests] = await pool.execute(
      `SELECT lr.*, 
              CONCAT(u.first_name, ' ', u.last_name) as user_name,
              u.email, u.photo_url,
              r.room_number, r.floor
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
       LEFT JOIN rooms r ON ra.room_id = r.id
       WHERE lr.qr_code = ?`,
      [qrCode]
    );

    if (requests.length === 0) {
      return res.json({ 
        data: {
          valid: false, 
          message: 'Invalid QR code'
        }
      });
    }

    const request = requests[0];

    // Check if request is in valid state
    if (!['approved', 'active'].includes(request.status)) {
      return res.json({ 
        data: {
          valid: false, 
          message: `Leave request status: ${request.status}`,
          leave_request: request
        }
      });
    }

    // All dates are now stored and compared in UTC
    const now = new Date();
    const startDate = new Date(request.start_date);
    const endDate = new Date(request.end_date);

    // Check if within valid date range (with 30 min buffer for early arrival)
    const bufferMs = 30 * 60 * 1000;
    if (now.getTime() < startDate.getTime() - bufferMs) {
      return res.json({ 
        data: {
          valid: false, 
          message: `Leave request not yet valid. Starts at ${startDate.toISOString()}`,
          leave_request: request
        }
      });
    }
    
    if (now > endDate) {
      return res.json({ 
        data: {
          valid: false, 
          message: 'Leave request has expired',
          leave_request: request
        }
      });
    }

    res.json({
      data: {
        valid: true,
        message: 'Pass verified successfully',
        leave_request: request
      }
    });
  } catch (error) {
    console.error('Verify QR code error:', error);
    res.status(500).json({ error: 'Failed to verify QR code' });
  }
};

exports.recordExit = async (req, res) => {
  try {
    const { id } = req.params;
    const guardId = req.user.id;

    const [requests] = await pool.execute(
      `SELECT lr.*, u.parent_id, u.first_name, u.last_name 
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       WHERE lr.id = ?`,
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const request = requests[0];

    if (request.status !== 'approved') {
      return res.status(400).json({ error: 'Leave request must be approved to record exit' });
    }

    if (request.exit_time) {
      return res.status(400).json({ error: 'Exit already recorded' });
    }

    // Update leave request
    await pool.execute(
      `UPDATE leave_requests SET 
       exit_time = NOW(), 
       exit_recorded_by = ?,
       status = 'active'
       WHERE id = ?`,
      [guardId, id]
    );

    // Create check log
    await pool.execute(
      `INSERT INTO check_logs (user_id, leave_request_id, type, method, recorded_by)
       VALUES (?, ?, 'check-out', 'qr_scan', ?)`,
      [request.user_id, id, guardId]
    );

    // Notify parent if exists
    if (request.parent_id) {
      const childName = `${request.first_name} ${request.last_name}`;
      await notificationController.notifyParentChildMovement(request.parent_id, childName, 'exit', id);
    }

    res.json({ message: 'Exit recorded successfully' });
  } catch (error) {
    console.error('Record exit error:', error);
    res.status(500).json({ error: 'Failed to record exit' });
  }
};

exports.recordReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const guardId = req.user.id;

    const [requests] = await pool.execute(
      `SELECT lr.*, u.parent_id, u.first_name, u.last_name 
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       WHERE lr.id = ?`,
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const request = requests[0];

    if (request.status !== 'active') {
      return res.status(400).json({ error: 'Resident has not exited yet' });
    }

    if (request.return_time) {
      return res.status(400).json({ error: 'Return already recorded' });
    }

    // Update leave request
    await pool.execute(
      `UPDATE leave_requests SET 
       return_time = NOW(), 
       return_recorded_by = ?,
       status = 'completed'
       WHERE id = ?`,
      [guardId, id]
    );

    // Create check log
    await pool.execute(
      `INSERT INTO check_logs (user_id, leave_request_id, type, method, recorded_by)
       VALUES (?, ?, 'check-in', 'qr_scan', ?)`,
      [request.user_id, id, guardId]
    );

    // Notify parent if exists
    if (request.parent_id) {
      const childName = `${request.first_name} ${request.last_name}`;
      await notificationController.notifyParentChildMovement(request.parent_id, childName, 'return', id);
    }

    res.json({ message: 'Return recorded successfully. Leave request completed.' });
  } catch (error) {
    console.error('Record return error:', error);
    res.status(500).json({ error: 'Failed to record return' });
  }
};

exports.cancel = async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const [existing] = await pool.execute(
      'SELECT * FROM leave_requests WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = existing[0];

    if (request.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Can only cancel if not yet active
    if (['active', 'completed'].includes(request.status)) {
      return res.status(400).json({ error: 'Cannot cancel an active or completed request' });
    }

    await pool.execute(
      'UPDATE leave_requests SET status = "cancelled" WHERE id = ?',
      [id]
    );

    res.json({ message: 'Leave request cancelled' });
  } catch (error) {
    console.error('Cancel leave request error:', error);
    res.status(500).json({ error: 'Failed to cancel leave request' });
  }
};

exports.getMyQRCode = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get the most recent approved/active leave request with QR code
    const [requests] = await pool.execute(
      `SELECT id, qr_code, status, start_date, end_date, destination, leave_type
       FROM leave_requests 
       WHERE user_id = ? AND qr_code IS NOT NULL AND status IN ('approved', 'active')
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'No active approved leave request found' });
    }

    const request = requests[0];
    res.json({ data: { qr_code: request.qr_code, leave_request: request } });
  } catch (error) {
    console.error('Get my QR code error:', error);
    res.status(500).json({ error: 'Failed to fetch QR code' });
  }
};
