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
      `SELECT cl.*, u.first_name, u.last_name, r.room_number
       FROM check_logs cl
       JOIN users u ON cl.user_id = u.id
       LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
       LEFT JOIN rooms r ON ra.room_id = r.id
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

    // Find user by QR code (assuming QR contains resident ID like "RES001")
    const [users] = await pool.execute(
      `SELECT u.*, r.room_number, r.floor
       FROM users u
       LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
       LEFT JOIN rooms r ON ra.room_id = r.id
       WHERE u.id = ? AND u.role = 'resident' AND u.status = 'active'`,
      [qrCode.replace('RES', '')]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Resident not found' });
    }

    const user = users[0];

    // Record the check-in/check-out
    const [result] = await pool.execute(
      `INSERT INTO check_logs (user_id, type, method, recorded_by)
       VALUES (?, ?, 'qr_scan', ?)`,
      [user.id, type, req.user.id]
    );

    res.json({
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
