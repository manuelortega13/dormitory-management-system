const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { sendNotificationToUser } = require('../services/socket.service');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, deanType: user.dean_type || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Generate unique student resident ID (format: PAC-XXXXXX)
const generateStudentResidentId = async () => {
  const prefix = 'PAC';
  let isUnique = false;
  let studentResidentId;
  
  while (!isUnique) {
    // Generate random 6-digit number
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    studentResidentId = `${prefix}-${randomNum}`;
    
    // Check if it already exists
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE student_resident_id = ?',
      [studentResidentId]
    );
    
    if (existing.length === 0) {
      isUnique = true;
    }
  }
  
  return studentResidentId;
};

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, phone, parentId, gender, address, course, yearLevel, faceImage, studentResidentId } = req.body;

    // Only allow certain roles for self-registration
    const allowedRoles = ['resident', 'parent'];
    const userRole = allowedRoles.includes(role) ? role : 'resident';

    // Check if user exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Validate face image for parent registration
    if (userRole === 'parent' && !faceImage) {
      return res.status(400).json({ error: 'Face image is required for parent registration' });
    }

    // For parent registration, validate and find the student
    let linkedStudentId = null;
    if (userRole === 'parent' && studentResidentId) {
      const [students] = await pool.execute(
        'SELECT id FROM users WHERE student_resident_id = ? AND role = "resident"',
        [studentResidentId]
      );
      
      if (students.length === 0) {
        return res.status(400).json({ error: 'Student Resident ID not found. Please check the ID and try again.' });
      }
      
      linkedStudentId = students[0].id;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate student_resident_id for residents
    let generatedStudentId = null;
    if (userRole === 'resident') {
      generatedStudentId = await generateStudentResidentId();
    }

    // Set registration status (pending for parents, approved for residents)
    const registrationStatus = userRole === 'parent' ? 'pending' : 'approved';

    // Create user with additional fields
    const [result] = await pool.execute(
      `INSERT INTO users (email, password, first_name, last_name, role, phone, parent_id, gender, address, course, year_level, face_image, student_resident_id, registration_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, firstName, lastName, userRole, phone || null, linkedStudentId, gender || null, address || null, course || null, yearLevel || null, faceImage || null, generatedStudentId, registrationStatus]
    );

    // If parent registered, also update the student's parent_id reference and notify admins
    if (userRole === 'parent' && linkedStudentId) {
      // Note: The parent_id in users table refers to the parent's user id linked to a student
      // We'll update this after admin approval
    }

    // Send notification to all admins and home deans for parent registration
    if (userRole === 'parent') {
      const [adminsAndDeans] = await pool.execute(
        'SELECT id FROM users WHERE (role = ? OR role = ?) AND status = ?',
        ['admin', 'home_dean', 'active']
      );
      
      console.log(`Found ${adminsAndDeans.length} admins/deans to notify for parent registration`);
      
      for (const user of adminsAndDeans) {
        const notificationData = {
          title: 'New Parent Registration',
          message: `${firstName} ${lastName} has registered as a parent/guardian and is awaiting approval.`,
          type: 'registration',
          reference_id: result.insertId,
          reference_type: 'user'
        };
        
        // Insert into database
        const [notifResult] = await pool.execute(
          `INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            user.id,
            notificationData.title,
            notificationData.message,
            notificationData.type,
            notificationData.reference_id,
            notificationData.reference_type
          ]
        );
        
        // Send real-time notification via socket
        sendNotificationToUser(user.id, {
          id: notifResult.insertId,
          ...notificationData,
          is_read: false,
          created_at: new Date().toISOString()
        });
      }
    }

    // For parents, don't issue token until approved
    if (userRole === 'parent') {
      res.status(201).json({
        message: 'Registration submitted successfully. Please wait for admin approval before you can log in.',
        requiresApproval: true,
        user: {
          id: result.insertId,
          email,
          firstName,
          lastName,
          role: userRole
        }
      });
    } else {
      const token = generateToken({ id: result.insertId, email, role: userRole });

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: result.insertId,
          email,
          firstName,
          lastName,
          role: userRole,
          studentResidentId: generatedStudentId
        }
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND status = "active"',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check parent registration status
    if (user.role === 'parent' && user.registration_status === 'pending') {
      return res.status(403).json({ error: 'Your registration is pending admin approval. Please wait for approval before logging in.' });
    }

    if (user.role === 'parent' && user.registration_status === 'declined') {
      return res.status(403).json({ error: 'Your registration has been declined. Please contact the administrator for more information.' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        deanType: user.dean_type || null,
        studentResidentId: user.student_resident_id || null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });

    // Check if user still exists and is active
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ? AND status = "active"',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const newToken = generateToken(users[0]);

    res.json({ token: newToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};
