const { pool } = require('../config/database');

// Get all pending parent registrations
exports.getPendingRegistrations = async (req, res) => {
  try {
    const [registrations] = await pool.execute(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.face_image,
        u.registration_status,
        u.created_at,
        u.parent_id as linked_student_id,
        s.first_name as student_first_name,
        s.last_name as student_last_name,
        s.student_resident_id as student_resident_id,
        s.email as student_email
      FROM users u
      LEFT JOIN users s ON u.parent_id = s.id
      WHERE u.role = 'parent' AND u.registration_status = 'pending'
      ORDER BY u.created_at DESC
    `);

    res.json(registrations);
  } catch (error) {
    console.error('Error fetching pending registrations:', error);
    res.status(500).json({ error: 'Failed to fetch pending registrations' });
  }
};

// Get all parent registrations (for history view)
exports.getAllRegistrations = async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.face_image,
        u.registration_status,
        u.registration_reviewed_at,
        u.created_at,
        u.parent_id as linked_student_id,
        s.first_name as student_first_name,
        s.last_name as student_last_name,
        s.student_resident_id as student_resident_id,
        r.first_name as reviewer_first_name,
        r.last_name as reviewer_last_name
      FROM users u
      LEFT JOIN users s ON u.parent_id = s.id
      LEFT JOIN users r ON u.registration_reviewed_by = r.id
      WHERE u.role = 'parent'
    `;
    
    const params = [];
    
    if (status && status !== 'all') {
      query += ' AND u.registration_status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY u.created_at DESC';

    const [registrations] = await pool.execute(query, params);

    res.json(registrations);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
};

// Get single registration details
exports.getRegistrationById = async (req, res) => {
  try {
    const { id } = req.params;

    const [registrations] = await pool.execute(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.face_image,
        u.registration_status,
        u.registration_reviewed_at,
        u.created_at,
        u.parent_id as linked_student_id,
        s.first_name as student_first_name,
        s.last_name as student_last_name,
        s.student_resident_id as student_resident_id,
        s.email as student_email,
        s.course as student_course,
        s.year_level as student_year_level,
        r.first_name as reviewer_first_name,
        r.last_name as reviewer_last_name
      FROM users u
      LEFT JOIN users s ON u.parent_id = s.id
      LEFT JOIN users r ON u.registration_reviewed_by = r.id
      WHERE u.id = ? AND u.role = 'parent'
    `, [id]);

    if (registrations.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json(registrations[0]);
  } catch (error) {
    console.error('Error fetching registration:', error);
    res.status(500).json({ error: 'Failed to fetch registration' });
  }
};

// Approve parent registration
exports.approveRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // Check if registration exists and is pending
    const [registrations] = await pool.execute(
      'SELECT * FROM users WHERE id = ? AND role = "parent" AND registration_status = "pending"',
      [id]
    );

    if (registrations.length === 0) {
      return res.status(404).json({ error: 'Pending registration not found' });
    }

    const parent = registrations[0];

    // Update registration status
    await pool.execute(
      `UPDATE users 
       SET registration_status = 'approved', 
           registration_reviewed_by = ?, 
           registration_reviewed_at = NOW() 
       WHERE id = ?`,
      [adminId, id]
    );

    // If parent was linked to a student, update the student's parent_id
    if (parent.parent_id) {
      await pool.execute(
        'UPDATE users SET parent_id = ? WHERE id = ?',
        [parent.id, parent.parent_id]
      );
    }

    // Send notification to the parent
    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        'Registration Approved',
        'Your registration has been approved. You can now log in to your account.',
        'registration_approved',
        id,
        'user'
      ]
    );

    res.json({ message: 'Registration approved successfully' });
  } catch (error) {
    console.error('Error approving registration:', error);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
};

// Decline parent registration
exports.declineRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    // Check if registration exists and is pending
    const [registrations] = await pool.execute(
      'SELECT * FROM users WHERE id = ? AND role = "parent" AND registration_status = "pending"',
      [id]
    );

    if (registrations.length === 0) {
      return res.status(404).json({ error: 'Pending registration not found' });
    }

    // Update registration status
    await pool.execute(
      `UPDATE users 
       SET registration_status = 'declined', 
           registration_reviewed_by = ?, 
           registration_reviewed_at = NOW() 
       WHERE id = ?`,
      [adminId, id]
    );

    // Send notification to the parent
    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        'Registration Declined',
        reason || 'Your registration has been declined. Please contact the administrator for more information.',
        'registration_declined',
        id,
        'user'
      ]
    );

    res.json({ message: 'Registration declined successfully' });
  } catch (error) {
    console.error('Error declining registration:', error);
    res.status(500).json({ error: 'Failed to decline registration' });
  }
};

// Get pending registration count (for dashboard/badge)
exports.getPendingCount = async (req, res) => {
  try {
    const [result] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE role = "parent" AND registration_status = "pending"'
    );

    res.json({ count: result[0].count });
  } catch (error) {
    console.error('Error fetching pending count:', error);
    res.status(500).json({ error: 'Failed to fetch pending count' });
  }
};
