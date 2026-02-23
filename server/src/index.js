const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const { testConnection } = require('./config/database');
const initDatabase = require('./config/init-db');
const { initializeSocket } = require('./services/socket.service');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const roomRoutes = require('./routes/room.routes');
const leaveRequestRoutes = require('./routes/leave-request.routes');
const checkLogRoutes = require('./routes/check-log.routes');
const visitorRoutes = require('./routes/visitor.routes');
const incidentRoutes = require('./routes/incident.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
initializeSocket(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
  
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/health`);
    console.log(`🔌 WebSocket ready for connections`);
  });
};

startServer();
