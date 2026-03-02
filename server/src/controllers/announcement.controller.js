const { pool } = require('../config/database');
const { getIO } = require('../services/socket.service');

// Get all announcements (admin view)
exports.getAll = async (req, res) => {
  try {
    const { status, audience, priority } = req.query;
    const userRole = req.user.role;

    let query = `
      SELECT a.*, 
             u.first_name, u.last_name,
             CONCAT(u.first_name, ' ', u.last_name) as author_name
      FROM announcements a
      JOIN users u ON a.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by status
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }

    // Filter by audience
    if (audience) {
      query += ' AND a.audience = ?';
      params.push(audience);
    }

    // Filter by priority
    if (priority) {
      query += ' AND a.priority = ?';
      params.push(priority);
    }

    // Non-admin users only see published announcements for their audience
    if (!['admin', 'home_dean_men', 'home_dean_women', 'vpsas'].includes(userRole)) {
      query += ` AND a.status = 'published' AND (a.audience = 'all' OR a.audience = ?)`;
      params.push(userRole === 'parent' ? 'parents' : 'residents');
      query += ` AND (a.expires_at IS NULL OR a.expires_at > NOW())`;
    }

    query += ' ORDER BY a.created_at DESC';

    const [announcements] = await pool.execute(query, params);

    res.json({ data: announcements });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
};

// Get published announcements for public view (residents, parents)
exports.getPublished = async (req, res) => {
  try {
    const userRole = req.user.role;
    let audienceFilter = 'all';

    if (userRole === 'parent') {
      audienceFilter = 'parents';
    } else if (userRole === 'resident') {
      audienceFilter = 'residents';
    } else if (['security_guard', 'admin', 'home_dean_men', 'home_dean_women', 'vpsas'].includes(userRole)) {
      audienceFilter = 'staff';
    }

    const [announcements] = await pool.execute(
      `SELECT a.*, 
              u.first_name, u.last_name,
              CONCAT(u.first_name, ' ', u.last_name) as author_name
       FROM announcements a
       JOIN users u ON a.created_by = u.id
       WHERE a.status = 'published' 
         AND (a.audience = 'all' OR a.audience = ?)
         AND (a.expires_at IS NULL OR a.expires_at > NOW())
       ORDER BY 
         CASE a.priority 
           WHEN 'urgent' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'normal' THEN 3 
           WHEN 'low' THEN 4 
         END,
         a.created_at DESC`,
      [audienceFilter]
    );

    res.json({ data: announcements });
  } catch (error) {
    console.error('Get published announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
};

// Get single announcement
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [announcements] = await pool.execute(
      `SELECT a.*, 
              u.first_name, u.last_name,
              CONCAT(u.first_name, ' ', u.last_name) as author_name
       FROM announcements a
       JOIN users u ON a.created_by = u.id
       WHERE a.id = ?`,
      [id]
    );

    if (announcements.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json({ data: announcements[0] });
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
};

// Create announcement
exports.create = async (req, res) => {
  try {
    const { title, content, priority, status, audience, expires_at } = req.body;
    const createdBy = req.user.id;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const publishedAt = status === 'published' ? new Date() : null;
    const announcementAudience = audience || 'all';
    const announcementPriority = priority || 'normal';

    const [result] = await pool.execute(
      `INSERT INTO announcements (title, content, priority, status, audience, created_by, expires_at, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        content,
        announcementPriority,
        status || 'draft',
        announcementAudience,
        createdBy,
        expires_at || null,
        publishedAt
      ]
    );

    // Create notifications and emit real-time events if published
    if (status === 'published') {
      const io = getIO();
      const announcementId = result.insertId;

      // Determine which users should receive notifications based on audience
      let userQuery = '';
      if (announcementAudience === 'all') {
        userQuery = `SELECT id FROM users WHERE role IN ('resident', 'parent', 'security_guard', 'admin', 'home_dean_men', 'home_dean_women', 'vpsas')`;
      } else if (announcementAudience === 'residents') {
        userQuery = `SELECT id FROM users WHERE role = 'resident'`;
      } else if (announcementAudience === 'parents') {
        userQuery = `SELECT id FROM users WHERE role = 'parent'`;
      } else if (announcementAudience === 'staff') {
        userQuery = `SELECT id FROM users WHERE role IN ('security_guard', 'admin', 'home_dean_men', 'home_dean_women', 'vpsas')`;
      }

      if (userQuery) {
        const [users] = await pool.execute(userQuery);

        // Create notifications for each user
        const notificationValues = users.map(user => [
          user.id,
          'announcement',
          `📢 ${title}`,
          content.substring(0, 200) + (content.length > 200 ? '...' : ''),
          announcementId,
          'announcement'
        ]);

        if (notificationValues.length > 0) {
          const placeholders = notificationValues.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
          const flatValues = notificationValues.flat();

          await pool.execute(
            `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type) VALUES ${placeholders}`,
            flatValues
          );

          // Send real-time notifications to connected users
          for (const user of users) {
            io.to(`user:${user.id}`).emit('notification', {
              id: Date.now() + user.id,
              user_id: user.id,
              type: 'announcement',
              title: `📢 ${title}`,
              message: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
              reference_id: announcementId,
              reference_type: 'announcement',
              is_read: false,
              created_at: new Date().toISOString()
            });
          }
        }
      }

      // Emit announcement event for real-time page updates
      io.emit('announcement-published', {
        id: announcementId,
        title,
        content,
        priority: announcementPriority,
        audience: announcementAudience,
        published_at: publishedAt.toISOString(),
        created_at: new Date().toISOString(),
        author_name: null
      });
    }

    res.status(201).json({
      message: 'Announcement created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
};

// Update announcement
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, priority, status, audience, expires_at } = req.body;

    // Check if announcement exists
    const [existing] = await pool.execute('SELECT * FROM announcements WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const previousStatus = existing[0].status;
    const publishedAt = status === 'published' && previousStatus !== 'published' 
      ? new Date() 
      : existing[0].published_at;

    await pool.execute(
      `UPDATE announcements 
       SET title = ?, content = ?, priority = ?, status = ?, audience = ?, expires_at = ?, published_at = ?
       WHERE id = ?`,
      [
        title || existing[0].title,
        content || existing[0].content,
        priority || existing[0].priority,
        status || existing[0].status,
        audience || existing[0].audience,
        expires_at !== undefined ? expires_at : existing[0].expires_at,
        publishedAt,
        id
      ]
    );

    // Emit real-time notification if newly published
    if (status === 'published' && previousStatus !== 'published') {
      const io = getIO();
      io.emit('new-announcement', {
        id: parseInt(id),
        title: title || existing[0].title,
        priority: priority || existing[0].priority,
        audience: audience || existing[0].audience
      });
    }

    res.json({ message: 'Announcement updated successfully' });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
};

// Delete announcement
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute('DELETE FROM announcements WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
};

// Publish announcement
exports.publish = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute('SELECT * FROM announcements WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    await pool.execute(
      `UPDATE announcements SET status = 'published', published_at = NOW() WHERE id = ?`,
      [id]
    );

    const announcement = existing[0];
    const io = getIO();

    // Determine which users should receive notifications based on audience
    let userQuery = '';
    const params = [];

    if (announcement.audience === 'all') {
      userQuery = `SELECT id FROM users WHERE role IN ('resident', 'parent', 'security_guard', 'admin', 'home_dean_men', 'home_dean_women', 'vpsas')`;
    } else if (announcement.audience === 'residents') {
      userQuery = `SELECT id FROM users WHERE role = 'resident'`;
    } else if (announcement.audience === 'parents') {
      userQuery = `SELECT id FROM users WHERE role = 'parent'`;
    } else if (announcement.audience === 'staff') {
      userQuery = `SELECT id FROM users WHERE role IN ('security_guard', 'admin', 'home_dean_men', 'home_dean_women', 'vpsas')`;
    }

    if (userQuery) {
      const [users] = await pool.execute(userQuery, params);

      // Create notifications for each user
      const notificationValues = users.map(user => [
        user.id,
        'announcement',
        `📢 ${announcement.title}`,
        announcement.content.substring(0, 200) + (announcement.content.length > 200 ? '...' : ''),
        id,
        'announcement'
      ]);

      if (notificationValues.length > 0) {
        const placeholders = notificationValues.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const flatValues = notificationValues.flat();

        await pool.execute(
          `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type) VALUES ${placeholders}`,
          flatValues
        );

        // Send real-time notifications to connected users
        for (const user of users) {
          io.to(`user:${user.id}`).emit('notification', {
            id: Date.now() + user.id, // Temporary ID until refreshed
            user_id: user.id,
            type: 'announcement',
            title: `📢 ${announcement.title}`,
            message: announcement.content.substring(0, 200) + (announcement.content.length > 200 ? '...' : ''),
            reference_id: id,
            reference_type: 'announcement',
            is_read: false,
            created_at: new Date().toISOString()
          });
        }
      }
    }

    // Emit announcement update event for real-time page updates
    io.emit('announcement-published', {
      id: parseInt(id),
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      audience: announcement.audience,
      published_at: new Date().toISOString(),
      created_at: announcement.created_at,
      author_name: null // Will be fetched on refresh
    });

    res.json({ message: 'Announcement published successfully' });
  } catch (error) {
    console.error('Publish announcement error:', error);
    res.status(500).json({ error: 'Failed to publish announcement' });
  }
};

// Get announcement stats
exports.getStats = async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts,
        SUM(CASE WHEN priority = 'urgent' AND status = 'published' THEN 1 ELSE 0 END) as urgent
      FROM announcements
    `);

    res.json({ data: stats[0] });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};
