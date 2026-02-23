const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

// Map of userId -> Set of socket ids (user can have multiple connections)
const userSockets = new Map();

/**
 * Initialize Socket.IO with the HTTP server
 */
function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`🔌 User ${userId} connected (socket: ${socket.id})`);

    // Add socket to user's set of connections
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Join a room based on user ID for targeted notifications
    socket.join(`user:${userId}`);

    // Join role-based room (for broadcasting to all admins, etc.)
    socket.join(`role:${socket.userRole}`);

    socket.on('disconnect', () => {
      console.log(`🔌 User ${userId} disconnected (socket: ${socket.id})`);
      
      // Remove socket from user's set
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }
    });
  });

  console.log('🔌 Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

/**
 * Send notification to a specific user
 */
function sendNotificationToUser(userId, notification) {
  if (!io) return;
  
  io.to(`user:${userId}`).emit('notification', notification);
  console.log(`📬 Notification sent to user ${userId}:`, notification.title);
}

/**
 * Send notification to all users with a specific role
 */
function sendNotificationToRole(role, notification) {
  if (!io) return;
  
  io.to(`role:${role}`).emit('notification', notification);
  console.log(`📬 Notification sent to role ${role}:`, notification.title);
}

/**
 * Send notification to multiple users
 */
function sendNotificationToUsers(userIds, notification) {
  if (!io) return;
  
  userIds.forEach(userId => {
    io.to(`user:${userId}`).emit('notification', notification);
  });
  console.log(`📬 Notification sent to ${userIds.length} users:`, notification.title);
}

/**
 * Check if a user is currently connected
 */
function isUserOnline(userId) {
  return userSockets.has(userId) && userSockets.get(userId).size > 0;
}

/**
 * Get count of online users
 */
function getOnlineUsersCount() {
  return userSockets.size;
}

module.exports = {
  initializeSocket,
  getIO,
  sendNotificationToUser,
  sendNotificationToRole,
  sendNotificationToUsers,
  isUserOnline,
  getOnlineUsersCount
};
