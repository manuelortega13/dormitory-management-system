const { pool } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { status, date } = req.query;

    let query = `
      SELECT v.*, u.first_name as visiting_first_name, u.last_name as visiting_last_name,
             r.room_number
      FROM visitors v
      JOIN users u ON v.visiting_user_id = u.id
      LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
      LEFT JOIN rooms r ON ra.room_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND v.status = ?';
      params.push(status);
    }

    if (date) {
      query += ' AND DATE(v.check_in_time) = ?';
      params.push(date);
    }

    query += ' ORDER BY v.check_in_time DESC';

    const [visitors] = await pool.execute(query, params);

    res.json(visitors);
  } catch (error) {
    console.error('Get visitors error:', error);
    res.status(500).json({ error: 'Failed to fetch visitors' });
  }
};

exports.getCurrent = async (req, res) => {
  try {
    const [visitors] = await pool.execute(
      `SELECT v.*, u.first_name as visiting_first_name, u.last_name as visiting_last_name,
              r.room_number
       FROM visitors v
       JOIN users u ON v.visiting_user_id = u.id
       LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
       LEFT JOIN rooms r ON ra.room_id = r.id
       WHERE v.status = 'inside'
       ORDER BY v.check_in_time DESC`
    );

    res.json(visitors);
  } catch (error) {
    console.error('Get current visitors error:', error);
    res.status(500).json({ error: 'Failed to fetch current visitors' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [visitors] = await pool.execute(
      `SELECT v.*, u.first_name as visiting_first_name, u.last_name as visiting_last_name
       FROM visitors v
       JOIN users u ON v.visiting_user_id = u.id
       WHERE v.id = ?`,
      [id]
    );

    if (visitors.length === 0) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    res.json(visitors[0]);
  } catch (error) {
    console.error('Get visitor error:', error);
    res.status(500).json({ error: 'Failed to fetch visitor' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, phone, idType, idNumber, visitingUserId, purpose } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO visitors (name, phone, id_type, id_number, visiting_user_id, purpose, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, idType, idNumber, visitingUserId, purpose, req.user.id]
    );

    res.status(201).json({
      message: 'Visitor logged successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Create visitor error:', error);
    res.status(500).json({ error: 'Failed to log visitor' });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute(
      `UPDATE visitors SET status = 'left', check_out_time = NOW() WHERE id = ?`,
      [id]
    );

    res.json({ message: 'Visitor checked out successfully' });
  } catch (error) {
    console.error('Visitor checkout error:', error);
    res.status(500).json({ error: 'Failed to check out visitor' });
  }
};
