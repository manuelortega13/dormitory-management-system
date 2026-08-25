const { pool } = require('../config/database');

/**
 * A home dean is bound to one wing by `dean_type`, so an occupant of the other wing is
 * neither theirs to see nor theirs to move. False for the admin, the VP and a dean with
 * no wing set, who are all unrestricted.
 */
const isOutsideDeanWing = (user, gender) =>
  user.role === 'home_dean' && !!user.deanType && gender !== user.deanType;

/**
 * The wing a room belongs to. A home dean runs one wing only, so their choice is not
 * consulted - whatever the form sent, the room lands in their own wing. Returns null when
 * the value is missing or is not one of the two wings.
 */
const resolveRoomGender = (user, requested) => {
  if (user.role === 'home_dean' && user.deanType) return user.deanType;
  return ['male', 'female'].includes(requested) ? requested : null;
};

/**
 * A room with no wing set (one that predates the column) takes anyone; a room with a wing
 * takes only occupants of that wing.
 */
const roomAcceptsOccupant = (roomGender, occupantGender) => !roomGender || roomGender === occupantGender;

/**
 * Whether a room belongs to the wing this dean does not run. A room with no wing set is
 * nobody's yet, so it stays workable by either dean - and an unset wing reads as null or
 * undefined depending on the query, hence the truthiness check rather than a null compare.
 */
const isOtherWingRoom = (user, roomGender) => !!roomGender && isOutsideDeanWing(user, roomGender);

exports.getAll = async (req, res) => {
  try {
    const { status, floor, roomType } = req.query;

    let query = 'SELECT * FROM rooms WHERE 1=1';
    const params = [];

    // A home dean runs one wing, so they get its rooms plus any room with no wing set -
    // those are unassigned and still need somebody to claim them.
    if (req.user.role === 'home_dean' && req.user.deanType) {
      query += ' AND (gender = ? OR gender IS NULL)';
      params.push(req.user.deanType);
    }

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
    const params = [];
    let wingFilter = '';
    if (req.user.role === 'home_dean' && req.user.deanType) {
      wingFilter = ' AND (r.gender = ? OR r.gender IS NULL)';
      params.push(req.user.deanType);
    }

    const [rooms] = await pool.execute(
      `SELECT r.*, 
        (SELECT COUNT(*) FROM room_assignments ra WHERE ra.room_id = r.id AND ra.status = 'active') as current_occupants
       FROM rooms r
       WHERE r.status = 'available'${wingFilter}
       HAVING current_occupants < r.capacity
       ORDER BY r.room_number`,
      params
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

    const gender = resolveRoomGender(req.user, req.body.gender);
    if (!gender) {
      return res.status(400).json({ error: 'Choose whether this room is for male or female occupants' });
    }

    const [result] = await pool.execute(
      `INSERT INTO rooms (room_number, floor, capacity, room_type, gender, price_per_month, amenities)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [roomNumber, floor, capacity || 1, roomType || 'single', gender, pricePerMonth, JSON.stringify(amenities || [])]
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

    const [existing] = await pool.execute('SELECT gender FROM rooms WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    // A dean may claim an unassigned room for their wing, but not touch the other wing's.
    if (isOtherWingRoom(req.user, existing[0].gender)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const gender = resolveRoomGender(req.user, req.body.gender);
    if (!gender) {
      return res.status(400).json({ error: 'Choose whether this room is for male or female occupants' });
    }

    // Moving a room to the other wing would strand the occupants living in it.
    const [occupants] = await pool.execute(
      `SELECT COUNT(*) as count FROM room_assignments ra
       JOIN users u ON ra.user_id = u.id
       WHERE ra.room_id = ? AND ra.status = 'active' AND u.gender <> ?`,
      [id, gender]
    );
    if (occupants[0].count > 0) {
      return res.status(400).json({
        error: 'This room still has occupants of the other wing. Move them out before changing the room type.'
      });
    }

    await pool.execute(
      `UPDATE rooms SET room_number = ?, floor = ?, capacity = ?, status = ?, 
       room_type = ?, gender = ?, price_per_month = ?, amenities = ? WHERE id = ?`,
      [roomNumber, floor, capacity, status, roomType, gender, pricePerMonth, JSON.stringify(amenities || []), id]
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

    const [rooms] = await pool.execute('SELECT id, gender FROM rooms WHERE id = ?', [id]);
    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (isOtherWingRoom(req.user, rooms[0].gender)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // room_assignments cascades on room delete, so deleting an occupied room would quietly
    // take its occupants' assignments with it. Make emptying the room a deliberate step.
    const [active] = await pool.execute(
      "SELECT COUNT(*) as count FROM room_assignments WHERE room_id = ? AND status = 'active'",
      [id]
    );
    if (active[0].count > 0) {
      const { count } = active[0];
      return res.status(400).json({
        error: `This room still has ${count} occupant${count === 1 ? '' : 's'}. Remove them before deleting the room.`
      });
    }

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
    // A dean may only place occupants in their own wing's rooms.
    if (isOtherWingRoom(req.user, room[0].gender)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [currentAssignments] = await pool.execute(
      'SELECT COUNT(*) as count FROM room_assignments WHERE room_id = ? AND status = "active"',
      [id]
    );

    if (currentAssignments[0].count >= room[0].capacity) {
      return res.status(400).json({ error: 'Room is at full capacity' });
    }

    // A dean may only place their own wing's occupants. The picker is already filtered;
    // this closes the same gap on the API.
    const [targets] = await pool.execute('SELECT gender FROM users WHERE id = ?', [userId || null]);
    if (targets.length === 0) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    if (isOutsideDeanWing(req.user, targets[0].gender)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // A male room takes male occupants and a female room female ones. A room with no wing
    // set yet takes either, so rooms predating the column keep working.
    if (!roomAcceptsOccupant(room[0].gender, targets[0].gender)) {
      const wing = room[0].gender === 'male' ? 'male' : 'female';
      return res.status(400).json({ error: `This room is for ${wing} occupants only.` });
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
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.photo_url, u.gender,
              ra.id as assignment_id, ra.start_date, ra.end_date
       FROM room_assignments ra
       JOIN users u ON ra.user_id = u.id
       WHERE ra.room_id = ? AND ra.status = 'active'`,
      [id]
    );

    // Strip the identity of occupants outside a home dean's wing, but keep the row: the bed
    // is genuinely taken, and dropping it would show a phantom vacancy and offer an
    // assignment the capacity check would reject anyway. The gender stays on a redacted row
    // only - it is what "the other wing" already meant, and it labels the row on screen.
    res.json(occupants.map(({ gender, ...occupant }) =>
      isOutsideDeanWing(req.user, gender)
        ? {
            id: occupant.id,
            assignment_id: occupant.assignment_id,
            start_date: occupant.start_date,
            end_date: occupant.end_date,
            gender,
            restricted: true
          }
        : occupant
    ));
  } catch (error) {
    console.error('Get occupants error:', error);
    res.status(500).json({ error: 'Failed to fetch occupants' });
  }
};

exports.unassignResident = async (req, res) => {
  try {
    const { id, userId } = req.params;

    // Removing an occupant of the other wing is not a dean's call.
    const [targets] = await pool.execute('SELECT gender FROM users WHERE id = ?', [userId]);
    if (targets.length > 0 && isOutsideDeanWing(req.user, targets[0].gender)) {
      return res.status(403).json({ error: 'Access denied' });
    }

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
