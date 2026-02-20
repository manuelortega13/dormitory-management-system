const { pool } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { status, severity } = req.query;

    let query = `
      SELECT i.*, 
             ru.first_name as reporter_first_name, ru.last_name as reporter_last_name,
             su.first_name as resolver_first_name, su.last_name as resolver_last_name
      FROM incidents i
      LEFT JOIN users ru ON i.reported_by = ru.id
      LEFT JOIN users su ON i.resolved_by = su.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    if (severity) {
      query += ' AND i.severity = ?';
      params.push(severity);
    }

    query += ' ORDER BY i.created_at DESC';

    const [incidents] = await pool.execute(query, params);

    res.json(incidents);
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
};

exports.getOpen = async (req, res) => {
  try {
    const [incidents] = await pool.execute(
      `SELECT i.*, ru.first_name as reporter_first_name, ru.last_name as reporter_last_name
       FROM incidents i
       LEFT JOIN users ru ON i.reported_by = ru.id
       WHERE i.status IN ('open', 'investigating')
       ORDER BY 
         CASE i.severity 
           WHEN 'critical' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           ELSE 4 
         END,
         i.created_at DESC`
    );

    res.json(incidents);
  } catch (error) {
    console.error('Get open incidents error:', error);
    res.status(500).json({ error: 'Failed to fetch open incidents' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [incidents] = await pool.execute(
      `SELECT i.*, 
              ru.first_name as reporter_first_name, ru.last_name as reporter_last_name,
              su.first_name as resolver_first_name, su.last_name as resolver_last_name
       FROM incidents i
       LEFT JOIN users ru ON i.reported_by = ru.id
       LEFT JOIN users su ON i.resolved_by = su.id
       WHERE i.id = ?`,
      [id]
    );

    if (incidents.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    res.json(incidents[0]);
  } catch (error) {
    console.error('Get incident error:', error);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, description, severity, location } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO incidents (title, description, severity, location, reported_by)
       VALUES (?, ?, ?, ?, ?)`,
      [title, description, severity || 'low', location, req.user.id]
    );

    res.status(201).json({
      message: 'Incident reported successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Create incident error:', error);
    res.status(500).json({ error: 'Failed to report incident' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, severity, location, status } = req.body;

    await pool.execute(
      `UPDATE incidents SET title = ?, description = ?, severity = ?, location = ?, status = ?
       WHERE id = ?`,
      [title, description, severity, location, status, id]
    );

    res.json({ message: 'Incident updated successfully' });
  } catch (error) {
    console.error('Update incident error:', error);
    res.status(500).json({ error: 'Failed to update incident' });
  }
};

exports.resolve = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;

    await pool.execute(
      `UPDATE incidents SET 
       status = 'resolved', resolved_by = ?, resolved_at = NOW(), resolution_notes = ?
       WHERE id = ?`,
      [req.user.id, resolutionNotes, id]
    );

    res.json({ message: 'Incident resolved successfully' });
  } catch (error) {
    console.error('Resolve incident error:', error);
    res.status(500).json({ error: 'Failed to resolve incident' });
  }
};
