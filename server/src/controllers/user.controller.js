const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { role, status, search } = req.query;
    
    let query = 'SELECT id, email, first_name, last_name, role, phone, photo_url, status, created_at FROM users WHERE 1=1';
    const params = [];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY created_at DESC';

    const [users] = await pool.execute(query, params);

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    // Users can only view their own profile unless admin
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name, role, phone, photo_url, status, created_at FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, password, parentId } = req.body;

    // Users can only update their own profile unless admin
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = 'UPDATE users SET first_name = ?, last_name = ?, phone = ?';
    const params = [firstName, lastName, phone];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    // Only admin can update parent_id
    if (req.user.role === 'admin' && parentId !== undefined) {
      query += ', parent_id = ?';
      params.push(parentId);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await pool.execute(query, params);

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

exports.getUserRoom = async (req, res) => {
  try {
    const { id } = req.params;

    const [assignments] = await pool.execute(
      `SELECT ra.*, r.room_number, r.floor, r.room_type, r.amenities
       FROM room_assignments ra
       JOIN rooms r ON ra.room_id = r.id
       WHERE ra.user_id = ? AND ra.status = 'active'`,
      [id]
    );

    if (assignments.length === 0) {
      return res.status(404).json({ error: 'No active room assignment found' });
    }

    res.json(assignments[0]);
  } catch (error) {
    console.error('Get user room error:', error);
    res.status(500).json({ error: 'Failed to fetch user room' });
  }
};

exports.getResidents = async (req, res) => {
  try {
    const { status, search, floor } = req.query;

    let query = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.phone, u.photo_url, u.status, u.created_at,
        r.room_number, r.floor, r.room_type,
        ra.start_date, ra.end_date,
        p.id as parent_id, p.first_name as parent_first_name, p.last_name as parent_last_name, p.email as parent_email, p.phone as parent_phone
      FROM users u
      LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
      LEFT JOIN rooms r ON ra.room_id = r.id
      LEFT JOIN users p ON u.parent_id = p.id
      WHERE u.role = 'resident'
    `;
    const params = [];

    if (status) {
      query += ' AND u.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (floor) {
      query += ' AND r.floor = ?';
      params.push(floor);
    }

    query += ' ORDER BY u.created_at DESC';

    const [residents] = await pool.execute(query, params);

    res.json(residents);
  } catch (error) {
    console.error('Get residents error:', error);
    res.status(500).json({ error: 'Failed to fetch residents' });
  }
};

exports.suspendResident = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Please provide a valid reason (at least 10 characters)' });
    }

    // Check if user exists and is a resident
    const [users] = await pool.execute(
      'SELECT id, role, status FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (users[0].role !== 'resident') {
      return res.status(400).json({ error: 'Only residents can be suspended' });
    }

    if (users[0].status === 'suspended') {
      return res.status(400).json({ error: 'Resident is already suspended' });
    }

    // Update user status to suspended
    await pool.execute(
      'UPDATE users SET status = ? WHERE id = ?',
      ['suspended', id]
    );

    // Log the suspension reason (could be stored in a separate audit table if needed)
    console.log(`Resident ${id} suspended by admin ${req.user.id}. Reason: ${reason.trim()}`);

    res.json({ message: 'Resident suspended successfully' });
  } catch (error) {
    console.error('Suspend resident error:', error);
    res.status(500).json({ error: 'Failed to suspend resident' });
  }
};

exports.reactivateResident = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists and is suspended
    const [users] = await pool.execute(
      'SELECT id, role, status FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (users[0].role !== 'resident') {
      return res.status(400).json({ error: 'Only residents can be reactivated' });
    }

    if (users[0].status !== 'suspended') {
      return res.status(400).json({ error: 'Resident is not suspended' });
    }

    // Update user status to active
    await pool.execute(
      'UPDATE users SET status = ? WHERE id = ?',
      ['active', id]
    );

    res.json({ message: 'Resident reactivated successfully' });
  } catch (error) {
    console.error('Reactivate resident error:', error);
    res.status(500).json({ error: 'Failed to reactivate resident' });
  }
};
