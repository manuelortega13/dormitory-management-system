const { pool } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { status, floor, roomType } = req.query;

    let query = 'SELECT * FROM rooms WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (floor) {
      query += ' AND floor = ?';
      params.push(floor);
    }

    if (roomType) {
      query += ' AND room_type = ?';
      params.push(roomType);
    }

    query += ' ORDER BY room_number';

    const [rooms] = await pool.execute(query, params);

    res.json(rooms);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
};

exports.getAvailable = async (req, res) => {
  try {
    const [rooms] = await pool.execute(
      `SELECT r.*, 
        (SELECT COUNT(*) FROM room_assignments ra WHERE ra.room_id = r.id AND ra.status = 'active') as current_occupants
       FROM rooms r
       WHERE r.status = 'available'
       HAVING current_occupants < r.capacity
       ORDER BY r.room_number`
    );

    res.json(rooms);
  } catch (error) {
    console.error('Get available rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch available rooms' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rooms] = await pool.execute('SELECT * FROM rooms WHERE id = ?', [id]);

    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(rooms[0]);
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
};

exports.create = async (req, res) => {
  try {
    const { roomNumber, floor, capacity, roomType, pricePerMonth, amenities } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO rooms (room_number, floor, capacity, room_type, price_per_month, amenities)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [roomNumber, floor, capacity || 1, roomType || 'single', pricePerMonth, JSON.stringify(amenities || [])]
    );

    res.status(201).json({
      message: 'Room created successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { roomNumber, floor, capacity, status, roomType, pricePerMonth, amenities } = req.body;

    await pool.execute(
      `UPDATE rooms SET room_number = ?, floor = ?, capacity = ?, status = ?, 
       room_type = ?, price_per_month = ?, amenities = ? WHERE id = ?`,
      [roomNumber, floor, capacity, status, roomType, pricePerMonth, JSON.stringify(amenities || []), id]
    );

    res.json({ message: 'Room updated successfully' });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['available', 'occupied', 'maintenance', 'reserved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await pool.execute('UPDATE rooms SET status = ? WHERE id = ?', [status, id]);

    res.json({ message: 'Room status updated successfully' });
  } catch (error) {
    console.error('Update room status error:', error);
    res.status(500).json({ error: 'Failed to update room status' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute('DELETE FROM rooms WHERE id = ?', [id]);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
};

exports.assignResident = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, startDate, endDate } = req.body;

    // Check room capacity
    const [room] = await pool.execute('SELECT * FROM rooms WHERE id = ?', [id]);
    if (room.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const [currentAssignments] = await pool.execute(
      'SELECT COUNT(*) as count FROM room_assignments WHERE room_id = ? AND status = "active"',
      [id]
    );

    if (currentAssignments[0].count >= room[0].capacity) {
      return res.status(400).json({ error: 'Room is at full capacity' });
    }

    // Create assignment
    const [result] = await pool.execute(
      'INSERT INTO room_assignments (user_id, room_id, start_date, end_date) VALUES (?, ?, ?, ?)',
      [userId, id, startDate, endDate || null]
    );

    // Update room status if now full
    if (currentAssignments[0].count + 1 >= room[0].capacity) {
      await pool.execute('UPDATE rooms SET status = "occupied" WHERE id = ?', [id]);
    }

    res.status(201).json({
      message: 'Resident assigned successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Assign resident error:', error);
    res.status(500).json({ error: 'Failed to assign resident' });
  }
};

exports.getOccupants = async (req, res) => {
  try {
    const { id } = req.params;

    const [occupants] = await pool.execute(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.photo_url,
              ra.id as assignment_id, ra.start_date, ra.end_date
       FROM room_assignments ra
       JOIN users u ON ra.user_id = u.id
       WHERE ra.room_id = ? AND ra.status = 'active'`,
      [id]
    );

    res.json(occupants);
  } catch (error) {
    console.error('Get occupants error:', error);
    res.status(500).json({ error: 'Failed to fetch occupants' });
  }
};

exports.unassignResident = async (req, res) => {
  try {
    const { id, userId } = req.params;

    // Update the assignment status to 'ended'
    const [result] = await pool.execute(
      `UPDATE room_assignments SET status = 'ended', end_date = CURDATE() 
       WHERE room_id = ? AND user_id = ? AND status = 'active'`,
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if room is now empty and update status
    const [remaining] = await pool.execute(
      'SELECT COUNT(*) as count FROM room_assignments WHERE room_id = ? AND status = "active"',
      [id]
    );

    if (remaining[0].count === 0) {
      await pool.execute('UPDATE rooms SET status = "available" WHERE id = ?', [id]);
    }

    res.json({ message: 'Resident unassigned successfully' });
  } catch (error) {
    console.error('Unassign resident error:', error);
    res.status(500).json({ error: 'Failed to unassign resident' });
  }
};
