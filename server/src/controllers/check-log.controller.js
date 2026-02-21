const { pool } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { type, date, limit } = req.query;

    let query = `
      SELECT cl.*, u.first_name, u.last_name, u.email,
             r.room_number
      FROM check_logs cl
      JOIN users u ON cl.user_id = u.id
      LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
      LEFT JOIN rooms r ON ra.room_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND cl.type = ?';
      params.push(type);
    }

    if (date) {
      query += ' AND DATE(cl.created_at) = ?';
      params.push(date);
    }

    query += ' ORDER BY cl.created_at DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }

    const [logs] = await pool.execute(query, params);

    res.json(logs);
  } catch (error) {
    console.error('Get check logs error:', error);
    res.status(500).json({ error: 'Failed to fetch check logs' });
  }
};

exports.getToday = async (req, res) => {
  try {
    const [logs] = await pool.execute(
      `SELECT cl.*, u.first_name, u.last_name, r.room_number, lr.leave_type
       FROM check_logs cl
       JOIN users u ON cl.user_id = u.id
       LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
       LEFT JOIN rooms r ON ra.room_id = r.id
       LEFT JOIN leave_requests lr ON cl.leave_request_id = lr.id
       WHERE DATE(cl.created_at) = CURDATE()
       ORDER BY cl.created_at DESC`
    );

    // Get stats
    const checkIns = logs.filter(l => l.type === 'check-in').length;
    const checkOuts = logs.filter(l => l.type === 'check-out').length;

    res.json({
      stats: { checkIns, checkOuts, total: logs.length },
      logs
    });
  } catch (error) {
    console.error('Get today logs error:', error);
    res.status(500).json({ error: 'Failed to fetch today logs' });
  }
};

exports.getByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Users can only view their own logs unless admin/security
    if (!['admin', 'security_guard'].includes(req.user.role) && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [logs] = await pool.execute(
      `SELECT * FROM check_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    res.json(logs);
  } catch (error) {
    console.error('Get user logs error:', error);
    res.status(500).json({ error: 'Failed to fetch user logs' });
  }
};

exports.getChildrenLogs = async (req, res) => {
  try {
    const parentId = req.user.id;

    const [logs] = await pool.execute(
      `SELECT cl.*, 
              CONCAT(u.first_name, ' ', u.last_name) as user_name,
              u.email, r.room_number, lr.leave_type, lr.destination
       FROM check_logs cl
       JOIN users u ON cl.user_id = u.id
       LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
       LEFT JOIN rooms r ON ra.room_id = r.id
       LEFT JOIN leave_requests lr ON cl.leave_request_id = lr.id
       WHERE u.parent_id = ?
       ORDER BY cl.created_at DESC
       LIMIT 100`,
      [parentId]
    );

    res.json({ data: logs });
  } catch (error) {
    console.error('Get children logs error:', error);
    res.status(500).json({ error: 'Failed to fetch children logs' });
  }
};

exports.checkIn = async (req, res) => {
  try {
    const { userId, method, notes } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO check_logs (user_id, type, method, recorded_by, notes)
       VALUES (?, 'check-in', ?, ?, ?)`,
      [userId, method || 'manual', req.user.id, notes || null]
    );

    res.status(201).json({
      message: 'Check-in recorded successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to record check-in' });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const { userId, method, notes } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO check_logs (user_id, type, method, recorded_by, notes)
       VALUES (?, 'check-out', ?, ?, ?)`,
      [userId, method || 'manual', req.user.id, notes || null]
    );

    res.status(201).json({
      message: 'Check-out recorded successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ error: 'Failed to record check-out' });
  }
};

exports.processScan = async (req, res) => {
  try {
    const { qrCode, type } = req.body;

    // First, try to find a leave request with this QR code
    const [leaveRequests] = await pool.execute(
      `SELECT lr.*, u.id as user_id, u.first_name, u.last_name, u.email, u.photo_url,
              r.room_number, r.floor
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
       LEFT JOIN rooms r ON ra.room_id = r.id
       WHERE lr.qr_code = ?`,
      [qrCode]
    );

    if (leaveRequests.length > 0) {
      const leaveRequest = leaveRequests[0];
      const now = new Date();
      const startDate = new Date(leaveRequest.start_date);
      const endDate = new Date(leaveRequest.end_date);

      // Check validity
      if (!['approved', 'active'].includes(leaveRequest.status)) {
        return res.status(400).json({ 
          valid: false,
          error: `Leave request is ${leaveRequest.status}`,
          leaveRequest
        });
      }

      if (now < startDate || now > endDate) {
        return res.status(400).json({ 
          valid: false,
          error: 'Leave request is not valid for current date/time',
          leaveRequest
        });
      }

      // Process based on type and current status
      if (type === 'check-out') {
        if (leaveRequest.status !== 'approved') {
          return res.status(400).json({ error: 'Leave request must be approved to record exit' });
        }
        if (leaveRequest.exit_time) {
          return res.status(400).json({ error: 'Exit already recorded' });
        }

        await pool.execute(
          `UPDATE leave_requests SET exit_time = NOW(), exit_recorded_by = ?, status = 'active' WHERE id = ?`,
          [req.user.id, leaveRequest.id]
        );
      } else {
        if (leaveRequest.status !== 'active') {
          return res.status(400).json({ error: 'Resident has not exited yet' });
        }
        if (leaveRequest.return_time) {
          return res.status(400).json({ error: 'Return already recorded' });
        }

        await pool.execute(
          `UPDATE leave_requests SET return_time = NOW(), return_recorded_by = ?, status = 'completed' WHERE id = ?`,
          [req.user.id, leaveRequest.id]
        );
      }

      // Record the check log
      const [result] = await pool.execute(
        `INSERT INTO check_logs (user_id, leave_request_id, type, method, recorded_by)
         VALUES (?, ?, ?, 'qr_scan', ?)`,
        [leaveRequest.user_id, leaveRequest.id, type, req.user.id]
      );

      return res.json({
        valid: true,
        message: `${type === 'check-in' ? 'Return' : 'Exit'} recorded successfully`,
        logId: result.insertId,
        leaveRequestId: leaveRequest.id,
        resident: {
          id: leaveRequest.user_id,
          name: `${leaveRequest.first_name} ${leaveRequest.last_name}`,
          roomNumber: leaveRequest.room_number,
          floor: leaveRequest.floor,
          destination: leaveRequest.destination,
          leaveType: leaveRequest.leave_type
        }
      });
    }

    // Fallback: Find user by legacy QR code format (RES001 style)
    const [users] = await pool.execute(
      `SELECT u.*, r.room_number, r.floor
       FROM users u
       LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
       LEFT JOIN rooms r ON ra.room_id = r.id
       WHERE u.id = ? AND u.role = 'resident' AND u.status = 'active'`,
      [qrCode.replace('RES', '')]
    );

    if (users.length === 0) {
      return res.status(404).json({ valid: false, error: 'Invalid QR code or resident not found' });
    }

    const user = users[0];

    // Record the check-in/check-out (no leave request)
    const [result] = await pool.execute(
      `INSERT INTO check_logs (user_id, type, method, recorded_by)
       VALUES (?, ?, 'qr_scan', ?)`,
      [user.id, type, req.user.id]
    );

    res.json({
      valid: true,
      message: `${type === 'check-in' ? 'Check-in' : 'Check-out'} recorded`,
      logId: result.insertId,
      resident: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        roomNumber: user.room_number,
        floor: user.floor
      }
    });
  } catch (error) {
    console.error('Process scan error:', error);
    res.status(500).json({ error: 'Failed to process scan' });
  }
};
