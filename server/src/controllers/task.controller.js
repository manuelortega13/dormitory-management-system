const { pool } = require('../config/database');

const SELECT_TASK = `
  SELECT t.*,
         CONCAT(u.first_name, ' ', u.last_name) AS occupant_name, u.student_resident_id,
         CONCAT(ab.first_name, ' ', ab.last_name) AS assigned_by_name
  FROM tasks t
  JOIN users u ON t.user_id = u.id
  LEFT JOIN users ab ON t.assigned_by = ab.id
`;

// GET /my — occupant's own tasks
exports.getMyTasks = async (req, res) => {
  try {
    const { status } = req.query;
    let query = SELECT_TASK + ' WHERE t.user_id = ?';
    const params = [req.user.id];
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    query += " ORDER BY (t.status = 'pending') DESC, t.created_at DESC";
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

// GET / — staff list (home_dean gender-scoped)
exports.getAll = async (req, res) => {
  try {
    const { status, user_id } = req.query;
    let query = SELECT_TASK + ' WHERE 1=1';
    const params = [];

    if (req.user.role === 'home_dean' && req.user.deanType) {
      query += ' AND u.gender = ?';
      params.push(req.user.deanType);
    }
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    if (user_id) {
      query += ' AND t.user_id = ?';
      params.push(user_id);
    }
    query += " ORDER BY (t.status = 'pending') DESC, t.created_at DESC";
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

// PATCH /:id/complete — only staff can close a task (dean-only-closes decision)
exports.completeTask = async (req, res) => {
  try {
    const { id } = req.params;

    const [tasks] = await pool.execute('SELECT id, status FROM tasks WHERE id = ?', [id]);
    if (tasks.length === 0) return res.status(404).json({ error: 'Task not found' });
    if (tasks[0].status === 'completed') {
      return res.status(400).json({ error: 'Task is already completed' });
    }

    await pool.execute(
      "UPDATE tasks SET status = 'completed', completed_at = NOW() WHERE id = ?",
      [id]
    );
    res.json({ success: true, message: 'Task marked as completed' });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
};
