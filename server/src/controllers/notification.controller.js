const { pool } = require('../config/database');
const { sendNotificationToUser } = require('../services/socket.service');
const { sendPushToUser } = require('../services/push.service');

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

    // Also send web push notification (fire-and-forget)
    sendPushToUser(userId, notification).catch(() => {});

    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    // Don't throw - notifications are non-critical
    return null;
  }
};

// Notify all admins/home_deans/vpsas about new leave request
// Home deans only receive notifications for residents matching their dean_type (gender)
exports.notifyAdminsNewRequest = async (residentName, leaveRequestId, residentGender = null) => {
  try {
    // Get admin and vpsas users - they receive all notifications
    const [generalAdmins] = await pool.execute(
      "SELECT id FROM users WHERE role IN ('admin', 'vpsas') AND status = 'active'"
    );

    // Get home_dean users with gender filtering
    let homeDeanQuery = "SELECT id FROM users WHERE role = 'home_dean' AND status = 'active'";
    const homeDeanParams = [];

    if (residentGender) {
      // Only notify home_deans whose dean_type matches the resident's gender
      homeDeanQuery += " AND (dean_type = ? OR dean_type IS NULL)";
      homeDeanParams.push(residentGender);
    }

    const [homeDeans] = await pool.execute(homeDeanQuery, homeDeanParams);

    const allRecipients = [...generalAdmins, ...homeDeans];

    for (const admin of allRecipients) {
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

// Notify home deans about new leave request (filtered by resident gender)
exports.notifyHomeDeanNewRequest = async (residentName, leaveRequestId, residentGender = null) => {
  try {
    let homeDeanQuery = "SELECT id FROM users WHERE role = 'home_dean' AND status = 'active'";
    const homeDeanParams = [];

    if (residentGender) {
      // Only notify home_deans whose dean_type matches the resident's gender
      homeDeanQuery += " AND (dean_type = ? OR dean_type IS NULL)";
      homeDeanParams.push(residentGender);
    }

    const [homeDeans] = await pool.execute(homeDeanQuery, homeDeanParams);

    for (const dean of homeDeans) {
      await exports.createNotification(
        dean.id,
        'leave_request_new',
        'New Leave Request',
        `${residentName} has submitted a new leave request requiring your approval`,
        leaveRequestId,
        'leave_request'
      );
    }
  } catch (error) {
    console.error('Notify home dean error:', error);
  }
};

// Notify resident that home dean approved (awaiting next step)
exports.notifyResidentDeanApproved = async (residentId, leaveRequestId) => {
  try {
    await exports.createNotification(
      residentId,
      'leave_request_dean_approved',
      'Home Dean Approved',
      'Your leave request has been approved by the Home Dean. Awaiting next approval.',
      leaveRequestId,
      'leave_request'
    );
  } catch (error) {
    console.error('Notify resident dean approved error:', error);
  }
};

// Notify VPSAS about pending approval
exports.notifyVpsasApprovalNeeded = async (residentName, leaveRequestId) => {
  try {
    const [vpsasUsers] = await pool.execute(
      "SELECT id FROM users WHERE role = 'vpsas' AND status = 'active'"
    );

    for (const vpsas of vpsasUsers) {
      await exports.createNotification(
        vpsas.id,
        'vpsas_approval_needed',
        'Approval Required',
        `${residentName}'s leave request needs your final approval`,
        leaveRequestId,
        'leave_request'
      );
    }
  } catch (error) {
    console.error('Notify VPSAS error:', error);
  }
};

// Notify resident that parent approved (awaiting VPSAS)
exports.notifyResidentParentApproved = async (residentId, leaveRequestId) => {
  try {
    await exports.createNotification(
      residentId,
      'leave_request_parent_approved',
      'Parent Approved',
      'Your leave request has been approved by your parent. Awaiting VPSAS approval.',
      leaveRequestId,
      'leave_request'
    );
  } catch (error) {
    console.error('Notify resident parent approved error:', error);
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

// Notify resident that Home Dean approved but awaiting parent approval
exports.notifyResidentAdminApproved = async (residentId, leaveRequestId) => {
  try {
    await exports.createNotification(
      residentId,
      'leave_request_admin_approved',
      'Home Dean Approved',
      'Your leave request has been approved by the Home Dean. Awaiting parent approval.',
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
// Home deans only receive notifications for residents matching their dean_type (gender)
exports.notifyAdminsRequestCancelled = async (residentName, leaveRequestId, residentGender = null) => {
  try {
    // Get admin and vpsas users - they receive all notifications
    const [generalAdmins] = await pool.execute(
      "SELECT id FROM users WHERE role IN ('admin', 'vpsas') AND status = 'active'"
    );

    // Get home_dean users with gender filtering
    let homeDeanQuery = "SELECT id FROM users WHERE role = 'home_dean' AND status = 'active'";
    const homeDeanParams = [];

    if (residentGender) {
      // Only notify home_deans whose dean_type matches the resident's gender
      homeDeanQuery += " AND (dean_type = ? OR dean_type IS NULL)";
      homeDeanParams.push(residentGender);
    }

    const [homeDeans] = await pool.execute(homeDeanQuery, homeDeanParams);

    const allRecipients = [...generalAdmins, ...homeDeans];

    for (const admin of allRecipients) {
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

// ==================== GATEPASS NOTIFICATIONS ====================

// Notify a parent that their child's gatepass needs approval (first approver)
exports.notifyParentGatepassNeeded = async (parentId, childName, gatepassId) => {
  try {
    await exports.createNotification(
      parentId,
      'gatepass_new',
      'Gatepass Approval Required',
      `${childName}'s gatepass request needs your approval`,
      gatepassId,
      'gatepass'
    );
  } catch (error) {
    console.error('Notify parent gatepass needed error:', error);
  }
};

// Notify home deans (gender-scoped) that a gatepass needs their approval (second approver)
exports.notifyDeanGatepassNeeded = async (childName, gatepassId, residentGender = null) => {
  try {
    let query = "SELECT id FROM users WHERE role = 'home_dean' AND status = 'active'";
    const params = [];
    if (residentGender) {
      query += ' AND (dean_type = ? OR dean_type IS NULL)';
      params.push(residentGender);
    }
    const [deans] = await pool.execute(query, params);
    for (const dean of deans) {
      await exports.createNotification(
        dean.id,
        'gatepass_parent_approved',
        'Gatepass Approval Required',
        `${childName}'s gatepass needs your approval`,
        gatepassId,
        'gatepass'
      );
    }
  } catch (error) {
    console.error('Notify dean gatepass needed error:', error);
  }
};

// Notify VPSAS that a gatepass needs final approval (third approver)
exports.notifyVpsasGatepassNeeded = async (childName, gatepassId) => {
  try {
    const [vpsasUsers] = await pool.execute(
      "SELECT id FROM users WHERE role = 'vpsas' AND status = 'active'"
    );
    for (const vpsas of vpsasUsers) {
      await exports.createNotification(
        vpsas.id,
        'gatepass_dean_approved',
        'Gatepass Approval Required',
        `${childName}'s gatepass needs your final approval`,
        gatepassId,
        'gatepass'
      );
    }
  } catch (error) {
    console.error('Notify vpsas gatepass needed error:', error);
  }
};

// Notify the occupant of an intermediate approval step
exports.notifyOccupantGatepassProgress = async (occupantId, type, message, gatepassId) => {
  try {
    await exports.createNotification(occupantId, type, 'Gatepass Update', message, gatepassId, 'gatepass');
  } catch (error) {
    console.error('Notify occupant gatepass progress error:', error);
  }
};

// Notify the occupant that their gatepass is fully approved and the QR is ready
exports.notifyOccupantGatepassApproved = async (occupantId, gatepassId) => {
  try {
    await exports.createNotification(
      occupantId,
      'gatepass_approved',
      'Gatepass Approved - QR Ready',
      'Your gatepass has been fully approved. Your QR code is now available!',
      gatepassId,
      'gatepass'
    );
  } catch (error) {
    console.error('Notify occupant gatepass approved error:', error);
  }
};

// Notify the occupant that their gatepass was declined
exports.notifyOccupantGatepassDeclined = async (occupantId, byRole, gatepassId) => {
  try {
    await exports.createNotification(
      occupantId,
      'gatepass_declined',
      'Gatepass Declined',
      `Your gatepass has been declined by ${byRole}`,
      gatepassId,
      'gatepass'
    );
  } catch (error) {
    console.error('Notify occupant gatepass declined error:', error);
  }
};

// Internal: active security guard user ids
async function getActiveGuardIds() {
  const [guards] = await pool.execute(
    "SELECT id FROM users WHERE role = 'security_guard' AND status = 'active'"
  );
  return guards.map((g) => g.id);
}

// Internal: active home dean ids, optionally gender-scoped
async function getDeanIds(residentGender = null) {
  let query = "SELECT id FROM users WHERE role = 'home_dean' AND status = 'active'";
  const params = [];
  if (residentGender) {
    query += ' AND (dean_type = ? OR dean_type IS NULL)';
    params.push(residentGender);
  }
  const [deans] = await pool.execute(query, params);
  return deans.map((d) => d.id);
}

// Notify a parent when their child leaves/returns on a gatepass
exports.notifyParentGatepassMovement = async (parentId, childName, action, gatepassId) => {
  try {
    const leaving = action === 'exit';
    await exports.createNotification(
      parentId,
      leaving ? 'gatepass_exit' : 'gatepass_returned',
      leaving ? 'Child Left Campus (Gatepass)' : 'Child Returned (Gatepass)',
      leaving
        ? `${childName} has left the campus on a gatepass`
        : `${childName} has returned from a gatepass`,
      gatepassId,
      'gatepass'
    );
  } catch (error) {
    console.error('Notify parent gatepass movement error:', error);
  }
};

// Notify parent + dean + vpsas + guards that a gatepass was extended (no approval needed)
exports.notifyGatepassExtended = async (gatepassId, childName, residentGender, parentId) => {
  try {
    const recipients = new Set();
    if (parentId) recipients.add(parentId);
    (await getDeanIds(residentGender)).forEach((id) => recipients.add(id));
    const [vpsasUsers] = await pool.execute("SELECT id FROM users WHERE role = 'vpsas' AND status = 'active'");
    vpsasUsers.forEach((v) => recipients.add(v.id));
    (await getActiveGuardIds()).forEach((id) => recipients.add(id));

    for (const uid of recipients) {
      await exports.createNotification(
        uid,
        'gatepass_extended',
        'Gatepass Extended',
        `${childName} has extended their gatepass by another hour`,
        gatepassId,
        'gatepass'
      );
    }
  } catch (error) {
    console.error('Notify gatepass extended error:', error);
  }
};

// Notify parent + dean + guards + the occupant that a gatepass is overdue
exports.notifyGatepassOverdue = async (gatepassId, childName, residentGender, parentId, occupantId) => {
  try {
    const recipients = new Set();
    if (parentId) recipients.add(parentId);
    (await getDeanIds(residentGender)).forEach((id) => recipients.add(id));
    (await getActiveGuardIds()).forEach((id) => recipients.add(id));
    if (occupantId) recipients.add(occupantId);

    for (const uid of recipients) {
      const isOccupant = uid === occupantId;
      await exports.createNotification(
        uid,
        'gatepass_overdue',
        'Gatepass Overdue',
        isOccupant
          ? 'Your gatepass is overdue. Please return to campus or extend your gatepass.'
          : `${childName} has not returned and their gatepass is overdue`,
        gatepassId,
        'gatepass'
      );
    }
  } catch (error) {
    console.error('Notify gatepass overdue error:', error);
  }
};

// Notify dean + occupant + parent that an occupant returned late (pending dean review)
exports.notifyGatepassLateReturn = async (gatepassId, childName, residentGender, parentId, occupantId) => {
  try {
    const recipients = new Set();
    (await getDeanIds(residentGender)).forEach((id) => recipients.add(id));
    if (occupantId) recipients.add(occupantId);
    if (parentId) recipients.add(parentId);

    for (const uid of recipients) {
      const isOccupant = uid === occupantId;
      await exports.createNotification(
        uid,
        'gatepass_late_return',
        isOccupant ? 'Late Return' : 'Occupant Returned Late',
        isOccupant
          ? "You returned to campus past your gatepass deadline. This is pending the Home Dean's review."
          : `${childName} returned to campus past their gatepass deadline.`,
        gatepassId,
        'gatepass'
      );
    }
  } catch (error) {
    console.error('Notify gatepass late return error:', error);
  }
};

// Notify the occupant that a disciplinary task was assigned
exports.notifyOccupantTaskAssigned = async (occupantId, gatepassId, taskTitle) => {
  try {
    await exports.createNotification(
      occupantId,
      'gatepass_task_assigned',
      'Disciplinary Task Assigned',
      `A task has been assigned to you: "${taskTitle}"`,
      gatepassId,
      'gatepass'
    );
  } catch (error) {
    console.error('Notify occupant task assigned error:', error);
  }
};