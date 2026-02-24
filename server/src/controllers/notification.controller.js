const { pool } = require('../config/database');
const { sendNotificationToUser } = require('../services/socket.service');

// Get all notifications for the current user
exports.getAll = async (req, res) => {
  try {
    const userId = req.user.id;
    const { unreadOnly, limit } = req.query;

    let query = `
      SELECT * FROM notifications 
      WHERE user_id = ?
    `;
    const params = [userId];

    if (unreadOnly === 'true') {
      query += ' AND is_read = FALSE';
    }

    query += ' ORDER BY created_at DESC';

    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
    }

    const [notifications] = await pool.execute(query, params);

    res.json({ data: notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Get unread notification count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const [result] = await pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    res.json({ count: result[0].count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};

// Delete a notification
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.execute(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

// Helper function to create a notification (used internally)
exports.createNotification = async (userId, type, title, message, referenceId = null, referenceType = null) => {
  try {
    const [result] = await pool.execute(
      `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, type, title, message, referenceId, referenceType]
    );

    const notification = {
      id: result.insertId,
      user_id: userId,
      type,
      title,
      message,
      reference_id: referenceId,
      reference_type: referenceType,
      is_read: false,
      created_at: new Date().toISOString()
    };

    // Send real-time notification via Socket.IO
    sendNotificationToUser(userId, notification);

    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    // Don't throw - notifications are non-critical
    return null;
  }
};

// Notify all admins/deans about new leave request
exports.notifyAdminsNewRequest = async (residentName, leaveRequestId) => {
  try {
    const [admins] = await pool.execute(
      "SELECT id FROM users WHERE role IN ('admin', 'dean') AND status = 'active'"
    );

    for (const admin of admins) {
      await exports.createNotification(
        admin.id,
        'leave_request_new',
        'New Leave Request',
        `${residentName} has submitted a new leave request`,
        leaveRequestId,
        'leave_request'
      );
    }
  } catch (error) {
    console.error('Notify admins error:', error);
  }
};

// Notify parent about child's leave request needing approval
exports.notifyParentApprovalNeeded = async (parentId, childName, leaveRequestId) => {
  try {
    await exports.createNotification(
      parentId,
      'parent_approval_needed',
      'Approval Required',
      `${childName}'s leave request needs your approval`,
      leaveRequestId,
      'leave_request'
    );
  } catch (error) {
    console.error('Notify parent error:', error);
  }
};

// Notify resident that admin approved but awaiting parent approval
exports.notifyResidentAdminApproved = async (residentId, leaveRequestId) => {
  try {
    await exports.createNotification(
      residentId,
      'leave_request_admin_approved',
      'Admin Approved',
      'Your leave request has been approved by admin. Awaiting parent approval.',
      leaveRequestId,
      'leave_request'
    );
  } catch (error) {
    console.error('Notify resident admin approved error:', error);
  }
};

// Notify resident that request is fully approved with QR code generated
exports.notifyResidentFullyApproved = async (residentId, approverRole, leaveRequestId) => {
  try {
    const message = approverRole === 'parent' 
      ? 'Your leave request has been approved by your parent. QR code is now available!'
      : 'Your leave request has been fully approved. QR code is now available!';

    await exports.createNotification(
      residentId,
      'leave_request_approved',
      'Request Approved - QR Ready',
      message,
      leaveRequestId,
      'leave_request'
    );
  } catch (error) {
    console.error('Notify resident fully approved error:', error);
  }
};

// Notify resident about request approval/decline
exports.notifyResidentRequestStatus = async (residentId, status, approverRole, leaveRequestId) => {
  try {
    const isApproved = status === 'approved';
    const type = isApproved ? 'leave_request_approved' : 'leave_request_declined';
    const title = isApproved ? 'Request Approved' : 'Request Declined';
    const message = isApproved 
      ? `Your leave request has been approved by ${approverRole}`
      : `Your leave request has been declined by ${approverRole}`;

    await exports.createNotification(
      residentId,
      type,
      title,
      message,
      leaveRequestId,
      'leave_request'
    );
  } catch (error) {
    console.error('Notify resident error:', error);
  }
};

// Notify parent when child leaves or returns to campus
exports.notifyParentChildMovement = async (parentId, childName, action, leaveRequestId) => {
  try {
    const isLeaving = action === 'exit';
    const type = isLeaving ? 'child_left_campus' : 'child_returned_campus';
    const title = isLeaving ? 'Child Left Campus' : 'Child Returned';
    const message = isLeaving 
      ? `${childName} has left the campus`
      : `${childName} has returned to campus`;

    await exports.createNotification(
      parentId,
      type,
      title,
      message,
      leaveRequestId,
      'leave_request'
    );
  } catch (error) {
    console.error('Notify parent child movement error:', error);
  }
};

// Notify admins when a resident cancels their leave request
exports.notifyAdminsRequestCancelled = async (residentName, leaveRequestId) => {
  try {
    const [admins] = await pool.execute(
      "SELECT id FROM users WHERE role IN ('admin', 'dean') AND status = 'active'"
    );

    for (const admin of admins) {
      await exports.createNotification(
        admin.id,
        'leave_request_cancelled',
        'Request Cancelled',
        `${residentName} has cancelled their leave request`,
        leaveRequestId,
        'leave_request'
      );
    }
  } catch (error) {
    console.error('Notify admins request cancelled error:', error);
  }
};