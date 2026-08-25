const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const notificationController = require('./notification.controller');
const { validateReferenceFace } = require('../services/face-verification.service');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, deanType: user.dean_type || null },
    process.env.JWT_SECRET,
    process.env.JWT_EXPIRES_IN ? { expiresIn: process.env.JWT_EXPIRES_IN } : {}
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

const VALID_GENDERS = ['male', 'female'];

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, phone, parentId, gender, address, course, yearLevel, faceImage, studentResidentId } = req.body;

    // Only allow certain roles for self-registration
    const allowedRoles = ['resident', 'parent'];
    const userRole = allowedRoles.includes(role) ? role : 'resident';

    // Gender decides which wing an occupant belongs to, and therefore which home dean sees
    // them at all. An occupant without one falls out of every dean's queue, so it is
    // enforced here rather than trusted from the two forms that post to this endpoint.
    if (userRole === 'resident' && !VALID_GENDERS.includes(gender)) {
      return res.status(400).json({ error: 'Gender is required and must be male or female' });
    }

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

    // The stored photo is the reference every future approval is matched against,
    // so it is validated here rather than trusted from the browser. A reference
    // photo with no usable face makes every later verification fail, and the
    // client-side check cannot be relied on (the FaceDetector API is Chrome-only
    // and its fallback is a skin-tone heuristic).
    if (userRole === 'parent') {
      const faceCheck = await validateReferenceFace(faceImage);
      if (!faceCheck.ok) {
        console.warn(
          `Parent registration rejected for ${email}: reference photo ${faceCheck.code}`
        );
        return res.status(faceCheck.code === 'engine_unavailable' ? 503 : 400).json({
          error: faceCheck.error,
          code: faceCheck.code,
        });
      }
    }

    // For parent registration, validate and find the student
    let linkedStudentId = null;
    // The occupant's wing decides which home dean reviews this registration, so it is read
    // here alongside the id rather than looked up again when the notification goes out.
    let linkedStudentGender = null;
    if (userRole === 'parent' && studentResidentId) {
      const [students] = await pool.execute(
        'SELECT id, gender FROM users WHERE student_resident_id = ? AND role = "resident"',
        [studentResidentId]
      );
      
      if (students.length === 0) {
        return res.status(400).json({ error: 'Student Resident ID not found. Please check the ID and try again.' });
      }
      
      linkedStudentId = students[0].id;
      linkedStudentGender = students[0].gender || null;
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

    // Notify the staff who can act on this registration. Home deans hear only about their
    // own wing, so the notification never points at a queue the recipient cannot see.
    if (userRole === 'parent') {
      await notificationController.notifyStaffNewParentRegistration(
        `${firstName} ${lastName}`,
        result.insertId,
        linkedStudentGender
      );
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
