const { pool } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let query = `
      SELECT lr.*, u.first_name, u.last_name, u.email
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Non-admins can only see their own requests
    if (!isAdmin) {
      query += ' AND lr.user_id = ?';
      params.push(userId);
    }

    if (status) {
      query += ' AND lr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY lr.created_at DESC';

    const [requests] = await pool.execute(query, params);

    res.json(requests);
  } catch (error) {
    console.error('Get leave requests error:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
};

exports.getPending = async (req, res) => {
  try {
    const [requests] = await pool.execute(
      `SELECT lr.*, u.first_name, u.last_name, u.email
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       WHERE lr.status = 'pending'
       ORDER BY lr.created_at ASC`
    );

    res.json(requests);
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [requests] = await pool.execute(
      `SELECT lr.*, u.first_name, u.last_name, u.email
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       WHERE lr.id = ?`,
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    // Check access
    if (req.user.role !== 'admin' && requests[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(requests[0]);
  } catch (error) {
    console.error('Get leave request error:', error);
    res.status(500).json({ error: 'Failed to fetch leave request' });
  }
};

exports.create = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason, destination, emergencyContact, emergencyPhone } = req.body;
    const userId = req.user.id;

    const [result] = await pool.execute(
      `INSERT INTO leave_requests 
       (user_id, leave_type, start_date, end_date, reason, destination, emergency_contact, emergency_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, leaveType, startDate, endDate, reason, destination, emergencyContact, emergencyPhone]
    );

    res.status(201).json({
      message: 'Leave request submitted successfully',
      id: result.insertId
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

    // Check if request exists and is pending
    const [existing] = await pool.execute(
      'SELECT * FROM leave_requests WHERE id = ? AND status = "pending"',
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
      [leaveType, startDate, endDate, reason, destination, emergencyContact, emergencyPhone, id]
    );

    res.json({ message: 'Leave request updated successfully' });
  } catch (error) {
    console.error('Update leave request error:', error);
    res.status(500).json({ error: 'Failed to update leave request' });
  }
};

exports.approve = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    await pool.execute(
      `UPDATE leave_requests SET 
       status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
       WHERE id = ?`,
      [req.user.id, notes || null, id]
    );

    res.json({ message: 'Leave request approved' });
  } catch (error) {
    console.error('Approve leave request error:', error);
    res.status(500).json({ error: 'Failed to approve leave request' });
  }
};

exports.decline = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    await pool.execute(
      `UPDATE leave_requests SET 
       status = 'declined', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
       WHERE id = ?`,
      [req.user.id, notes || null, id]
    );

    res.json({ message: 'Leave request declined' });
  } catch (error) {
    console.error('Decline leave request error:', error);
    res.status(500).json({ error: 'Failed to decline leave request' });
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

    if (existing[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
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
