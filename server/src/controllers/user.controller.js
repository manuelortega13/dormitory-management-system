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
    const { firstName, lastName, phone, password, parentId, gender, address, course, yearLevel } = req.body;

    // Users can only update their own profile unless admin
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = 'UPDATE users SET first_name = ?, last_name = ?, phone = ?';
    const params = [firstName || null, lastName || null, phone === undefined ? null : phone];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    // Only admin can update parent_id
    if (req.user.role === 'admin' && parentId !== undefined) {
      query += ', parent_id = ?';
      params.push(parentId === '' ? null : parentId);
    }

    // Handle additional resident fields
    if (gender !== undefined) {
      query += ', gender = ?';
      params.push(gender || null);
    }
    if (address !== undefined) {
      query += ', address = ?';
      params.push(address || null);
    }
    if (course !== undefined) {
      query += ', course = ?';
      params.push(course || null);
    }
    if (yearLevel !== undefined) {
      query += ', year_level = ?';
      params.push(yearLevel || null);
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
    const userRole = req.user.role;
    const deanType = req.user.deanType;

    let query = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.phone, u.photo_url, u.status, u.created_at,
        u.gender, u.address, u.course, u.year_level, u.student_resident_id,
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

    // Filter by gender if home_dean with dean_type
    if (userRole === 'home_dean' && deanType) {
      query += ' AND u.gender = ?';
      params.push(deanType);
    }

    if (status) {
      query += ' AND u.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.student_resident_id LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
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

// Create agent (admin, security_guard, home_dean, vpsas) - admin only
exports.createAgent = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, phone, deanType } = req.body;

    // Validate role - only allow agent roles
    const allowedRoles = ['admin', 'security_guard', 'home_dean', 'vpsas'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Allowed roles: admin, security_guard, home_dean, vpsas' });
    }

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate deanType for home_dean role
    if (role === 'home_dean') {
      if (!deanType || !['male', 'female'].includes(deanType)) {
        return res.status(400).json({ error: 'Dean type is required for Home Dean role. Must be "male" or "female"' });
      }
    }

    // Check if user exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [result] = await pool.execute(
      `INSERT INTO users (email, password, first_name, last_name, role, dean_type, phone, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [email, hashedPassword, firstName, lastName, role, role === 'home_dean' ? deanType : null, phone || null]
    );

    res.status(201).json({
      message: 'Agent created successfully',
      data: {
        id: result.insertId,
        email,
        firstName,
        lastName,
        role,
        phone
      }
    });
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
};

// Get all agents (admin, security_guard, home_dean, vpsas)
exports.getAgents = async (req, res) => {
  try {
    const { role, status, search } = req.query;

    let query = `SELECT id, email, first_name, last_name, role, dean_type, phone, photo_url, status, created_at 
                 FROM users WHERE role IN ('admin', 'security_guard', 'home_dean', 'vpsas')`;
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
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
};

// Update agent (admin, security_guard, home_dean, vpsas) - admin only
exports.updateAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, role, phone, deanType } = req.body;

    // Validate role - only allow agent roles
    const allowedRoles = ['admin', 'security_guard', 'home_dean', 'vpsas'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Allowed roles: admin, security_guard, home_dean, vpsas' });
    }

    // Validate required fields
    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate deanType for home_dean role
    if (role === 'home_dean') {
      if (!deanType || !['male', 'female'].includes(deanType)) {
        return res.status(400).json({ error: 'Dean type is required for Home Dean role. Must be "male" or "female"' });
      }
    }

    // Check if user exists and is an agent
    const [existingUsers] = await pool.execute(
      'SELECT id, role FROM users WHERE id = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (!allowedRoles.includes(existingUsers[0].role)) {
      return res.status(400).json({ error: 'Cannot update non-agent users with this endpoint' });
    }

    // Check if email already exists for another user
    const [emailCheck] = await pool.execute(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, id]
    );

    if (emailCheck.length > 0) {
      return res.status(400).json({ error: 'Email already registered to another user' });
    }

    // Update user
    await pool.execute(
      `UPDATE users SET 
        first_name = ?, 
        last_name = ?, 
        email = ?, 
        role = ?, 
        dean_type = ?, 
        phone = ?
       WHERE id = ?`,
      [firstName, lastName, email, role, role === 'home_dean' ? deanType : null, phone || null, id]
    );

    res.json({ message: 'Agent updated successfully' });
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
};
