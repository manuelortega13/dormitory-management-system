const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config({ path: '.env' });

const { testConnection } = require('./config/database');
const initDatabase = require('./config/init-db');
const { initializeSocket } = require('./services/socket.service');
const { initializeFaceVerification } = require('./services/face-verification.service');
const migrate = require('./migrate');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const roomRoutes = require('./routes/room.routes');
const leaveRequestRoutes = require('./routes/leave-request.routes');
const checkLogRoutes = require('./routes/check-log.routes');
const visitorRoutes = require('./routes/visitor.routes');
const incidentRoutes = require('./routes/incident.routes');
const notificationRoutes = require('./routes/notification.routes');
const parentRegistrationRoutes = require('./routes/parent-registration.routes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
initializeSocket(server);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/check-logs', checkLogRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/parent-registrations', parentRegistrationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Migration endpoint (protected)
app.post('/api/admin/run-migrations', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_MIGRATION_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    await migrate();
    res.json({ success: true, message: 'Migrations completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed endpoint (protected)
const { pool } = require('./config/database');
const fs = require('fs');
const path = require('path');

app.get('/api/admin/debug-users', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_MIGRATION_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const [users] = await pool.query('SELECT id, email, role, student_resident_id FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/run-seed', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_MIGRATION_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const seedPath = path.join(__dirname, 'config', 'seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8').replace(/USE railway;/g, '');
    
    const statements = seedSql.split(';').filter(s => s.trim().length > 0);
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (e) {
        // Ignore dup key errors
        if (!e.message.includes('Duplicate')) {
          console.warn('Seed warning:', e.message);
        }
      }
    }
    res.json({ success: true, message: 'Seed completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const startServer = async () => {
  await testConnection();
  await initDatabase();
  await migrate();
  
  // Pre-load face recognition models (optional but improves first verification speed)
  initializeFaceVerification().then(success => {
    if (success) {
      console.log('✅ Face recognition models loaded');
    } else {
      console.warn('⚠️ Face recognition models failed to load - verification may fail');
    }
  });
  
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/health`);
    console.log(`🔌 Socket.IO ready for real-time notifications`);
  });
};

startServer();
