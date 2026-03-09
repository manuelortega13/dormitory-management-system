const { pool } = require('../config/database');

// Helper to check if user has admin-level access
const isAdmin = (role) =>
  ['admin', 'home_dean', 'home_dean_men', 'home_dean_women', 'vpsas'].includes(role);

// Tool definitions for OpenAI function calling
const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'check_resident_campus_status',
      description: 'Check if a resident is currently inside or outside the campus based on check logs',
      parameters: {
        type: 'object',
        properties: {
          resident_name: {
            type: 'string',
            description: 'Resident name or student ID to search for',
          },
        },
        required: ['resident_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_announcements',
      description: 'Get announcements. Can filter by date or priority.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description:
              "Filter by date (YYYY-MM-DD format). Use 'today' for current date.",
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'urgent'],
            description: 'Filter by priority level',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_leave_requests',
      description:
        'Get leave request information. Can filter by status, resident name, or date range.',
      parameters: {
        type: 'object',
        properties: {
          resident_name: {
            type: 'string',
            description: 'Resident name or student ID to filter by',
          },
          status: {
            type: 'string',
            enum: [
              'pending_dean',
              'pending_admin',
              'pending_parent',
              'pending_vpsas',
              'approved',
              'declined',
              'cancelled',
              'active',
              'completed',
              'expired',
            ],
            description: 'Filter by leave request status',
          },
          active_only: {
            type: 'boolean',
            description: 'If true, only return currently active or pending requests',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_resident_info',
      description: 'Get resident details like name, room, course, year level, and contact info',
      parameters: {
        type: 'object',
        properties: {
          resident_name: {
            type: 'string',
            description: 'Resident name or student ID to search for',
          },
        },
        required: ['resident_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_room_info',
      description: 'Get room details including occupants, capacity, and status',
      parameters: {
        type: 'object',
        properties: {
          room_number: {
            type: 'string',
            description: 'Room number to look up',
          },
        },
        required: ['room_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payment_info',
      description: 'Get billing and payment status for a resident',
      parameters: {
        type: 'object',
        properties: {
          resident_name: {
            type: 'string',
            description: 'Resident name or student ID to look up',
          },
          status: {
            type: 'string',
            enum: ['unpaid', 'partial', 'paid', 'overdue', 'cancelled'],
            description: 'Filter bills by status',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_campus_stats',
      description:
        'Get overall campus statistics: how many residents are currently inside, outside, total count',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_visitors',
      description: 'Get visitor information. Can filter by status (inside/left) or resident.',
      parameters: {
        type: 'object',
        properties: {
          resident_name: {
            type: 'string',
            description: 'Resident name being visited',
          },
          status: {
            type: 'string',
            enum: ['inside', 'left'],
            description: 'Filter by visitor status',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_residents',
      description: 'Search for residents by name, student ID, or room number',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (name, student ID, or room number)',
          },
        },
        required: ['query'],
      },
    },
  },
];

// Get tools available for a given role
function getToolsForRole(role) {
  const allTools = toolDefinitions.map((t) => t.function.name);

  if (isAdmin(role)) {
    return toolDefinitions;
  }

  if (role === 'security_guard') {
    const allowed = ['check_resident_campus_status', 'get_campus_stats', 'get_visitors', 'search_residents', 'get_announcements'];
    return toolDefinitions.filter((t) => allowed.includes(t.function.name));
  }

  if (role === 'parent') {
    const allowed = [
      'check_resident_campus_status',
      'get_announcements',
      'get_leave_requests',
      'get_resident_info',
      'get_room_info',
      'get_payment_info',
    ];
    return toolDefinitions.filter((t) => allowed.includes(t.function.name));
  }

  // resident
  const allowed = [
    'check_resident_campus_status',
    'get_announcements',
    'get_leave_requests',
    'get_resident_info',
    'get_room_info',
    'get_payment_info',
    'get_visitors',
  ];
  return toolDefinitions.filter((t) => allowed.includes(t.function.name));
}

// --- Tool handler functions ---

async function checkResidentCampusStatus(params, user) {
  const { resident_name } = params;

  // Find the resident first
  const residents = await findResidents(resident_name, user);
  if (residents.length === 0) {
    return { found: false, message: 'No matching resident found or access denied.' };
  }

  const results = [];
  for (const resident of residents) {
    const [logs] = await pool.execute(
      `SELECT type, timestamp FROM check_logs
       WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1`,
      [resident.id]
    );

    const status =
      logs.length === 0
        ? 'unknown (no check logs)'
        : logs[0].type === 'check-in'
          ? 'inside campus'
          : 'outside campus';

    results.push({
      name: `${resident.first_name} ${resident.last_name}`,
      student_id: resident.student_resident_id,
      status,
      last_log_time: logs.length > 0 ? logs[0].timestamp : null,
    });
  }

  return { found: true, residents: results };
}

async function getAnnouncements(params, user) {
  let { date, priority } = params;

  let query = `
    SELECT a.title, a.content, a.priority, a.audience, a.published_at, a.expires_at,
           CONCAT(u.first_name, ' ', u.last_name) as author_name
    FROM announcements a
    JOIN users u ON a.created_by = u.id
    WHERE a.status = 'published'
  `;
  const queryParams = [];

  // Audience filtering for non-admins
  if (!isAdmin(user.role)) {
    query += ` AND (a.audience = 'all' OR a.audience = ?)`;
    if (user.role === 'parent') {
      queryParams.push('parents');
    } else if (user.role === 'security_guard') {
      queryParams.push('staff');
    } else {
      queryParams.push('residents');
    }
    query += ` AND (a.expires_at IS NULL OR a.expires_at > NOW())`;
  }

  if (date) {
    if (date === 'today') {
      query += ` AND DATE(a.published_at) = CURDATE()`;
    } else {
      query += ` AND DATE(a.published_at) = ?`;
      queryParams.push(date);
    }
  }

  if (priority) {
    query += ` AND a.priority = ?`;
    queryParams.push(priority);
  }

  query += ` ORDER BY a.published_at DESC LIMIT 10`;

  const [announcements] = await pool.execute(query, queryParams);
  return { count: announcements.length, announcements };
}

async function getLeaveRequests(params, user) {
  const { resident_name, status, active_only } = params;

  let query = `
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.reason, lr.destination,
           lr.status, lr.admin_status, lr.parent_status, lr.created_at,
           CONCAT(u.first_name, ' ', u.last_name) as resident_name,
           u.student_resident_id
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    WHERE 1=1
  `;
  const queryParams = [];

  // Role-based scoping
  if (user.role === 'resident') {
    query += ` AND lr.user_id = ?`;
    queryParams.push(user.id);
  } else if (user.role === 'parent') {
    query += ` AND lr.user_id IN (SELECT id FROM users WHERE parent_id = ?)`;
    queryParams.push(user.id);
  } else if (user.role === 'security_guard') {
    return { error: 'Security guards do not have access to leave request details.' };
  }

  if (resident_name && (isAdmin(user.role) || user.role === 'parent')) {
    query += ` AND (CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.student_resident_id LIKE ?)`;
    const searchTerm = `%${resident_name}%`;
    queryParams.push(searchTerm, searchTerm);
  }

  if (status) {
    query += ` AND lr.status = ?`;
    queryParams.push(status);
  }

  if (active_only) {
    query += ` AND lr.status IN ('pending_dean', 'pending_admin', 'pending_parent', 'pending_vpsas', 'approved', 'active')`;
  }

  query += ` ORDER BY lr.created_at DESC LIMIT 15`;

  const [requests] = await pool.execute(query, queryParams);
  return { count: requests.length, leave_requests: requests };
}

async function getResidentInfo(params, user) {
  const { resident_name } = params;

  const residents = await findResidents(resident_name, user);
  if (residents.length === 0) {
    return { found: false, message: 'No matching resident found or access denied.' };
  }

  const results = [];
  for (const r of residents) {
    // Get room assignment
    const [rooms] = await pool.execute(
      `SELECT rm.room_number, rm.floor, rm.room_type
       FROM room_assignments ra
       JOIN rooms rm ON ra.room_id = rm.id
       WHERE ra.user_id = ? AND ra.status = 'active'`,
      [r.id]
    );

    const info = {
      name: `${r.first_name} ${r.last_name}`,
      student_id: r.student_resident_id,
      email: r.email,
      phone: r.phone,
      course: r.course,
      year_level: r.year_level,
      gender: r.gender,
      status: r.status,
      room: rooms.length > 0 ? rooms[0] : null,
    };

    // Security guards only get basic info
    if (user.role === 'security_guard') {
      delete info.email;
      delete info.phone;
      delete info.course;
      delete info.year_level;
    }

    results.push(info);
  }

  return { found: true, residents: results };
}

async function getRoomInfo(params, user) {
  const { room_number } = params;

  if (user.role === 'security_guard') {
    return { error: 'Security guards do not have access to room information.' };
  }

  const [rooms] = await pool.execute(
    `SELECT id, room_number, floor, capacity, room_type, status, price_per_month
     FROM rooms WHERE room_number = ?`,
    [room_number]
  );

  if (rooms.length === 0) {
    return { found: false, message: `Room ${room_number} not found.` };
  }

  const room = rooms[0];

  // Get current occupants
  const [occupants] = await pool.execute(
    `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as name, u.student_resident_id
     FROM room_assignments ra
     JOIN users u ON ra.user_id = u.id
     WHERE ra.room_id = ? AND ra.status = 'active'`,
    [room.id]
  );

  // Role scoping: residents can only see their own room, parents their children's rooms
  if (user.role === 'resident') {
    const isOwnRoom = occupants.some((o) => o.id === user.id);
    if (!isOwnRoom) {
      return { error: 'You can only view your own room information.' };
    }
  } else if (user.role === 'parent') {
    const [children] = await pool.execute('SELECT id FROM users WHERE parent_id = ?', [user.id]);
    const childIds = children.map((c) => c.id);
    const isChildRoom = occupants.some((o) => childIds.includes(o.id));
    if (!isChildRoom) {
      return { error: "You can only view your children's room information." };
    }
  }

  return {
    found: true,
    room: {
      room_number: room.room_number,
      floor: room.floor,
      capacity: room.capacity,
      room_type: room.room_type,
      status: room.status,
      price_per_month: room.price_per_month,
      occupants: occupants.map((o) => ({ name: o.name, student_id: o.student_resident_id })),
      available_spots: room.capacity - occupants.length,
    },
  };
}

async function getPaymentInfo(params, user) {
  const { resident_name, status } = params;

  if (user.role === 'security_guard') {
    return { error: 'Security guards do not have access to payment information.' };
  }

  let targetUserIds = [];

  if (user.role === 'resident') {
    targetUserIds = [user.id];
  } else if (user.role === 'parent') {
    const [children] = await pool.execute('SELECT id FROM users WHERE parent_id = ?', [user.id]);
    targetUserIds = children.map((c) => c.id);
  } else if (isAdmin(user.role)) {
    if (resident_name) {
      const residents = await findResidents(resident_name, user);
      targetUserIds = residents.map((r) => r.id);
    } else {
      // Without a filter, return summary stats
      const [stats] = await pool.execute(`
        SELECT
          COUNT(*) as total_bills,
          SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid,
          SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
          SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
          SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial
        FROM bills
      `);
      return { summary: true, stats: stats[0] };
    }
  }

  if (targetUserIds.length === 0) {
    return { found: false, message: 'No matching resident found or access denied.' };
  }

  const placeholders = targetUserIds.map(() => '?').join(',');
  let query = `
    SELECT b.id as bill_id, b.type, b.description, b.amount, b.due_date, b.status,
           CONCAT(u.first_name, ' ', u.last_name) as resident_name,
           u.student_resident_id,
           COALESCE(SUM(CASE WHEN p.status IN ('verified', 'pending') THEN p.amount ELSE 0 END), 0) as total_paid,
           (b.amount - COALESCE(SUM(CASE WHEN p.status IN ('verified', 'pending') THEN p.amount ELSE 0 END), 0)) as remaining
    FROM bills b
    JOIN users u ON b.resident_id = u.id
    LEFT JOIN payments p ON p.bill_id = b.id AND p.status != 'rejected'
    WHERE b.resident_id IN (${placeholders})
  `;
  const queryParams = [...targetUserIds];

  if (status) {
    query += ` AND b.status = ?`;
    queryParams.push(status);
  }

  query += ` GROUP BY b.id ORDER BY b.due_date DESC LIMIT 15`;

  const [bills] = await pool.query(query, queryParams);
  return { count: bills.length, bills };
}

async function getCampusStats(params, user) {
  if (!isAdmin(user.role) && user.role !== 'security_guard') {
    return { error: 'Only admins and security guards can view campus stats.' };
  }

  // Total active residents
  const [totalRes] = await pool.execute(
    `SELECT COUNT(*) as total FROM users WHERE role = 'resident' AND status = 'active'`
  );

  // Residents currently outside (latest check_log is check-out)
  const [outsideRes] = await pool.execute(`
    SELECT COUNT(DISTINCT cl.user_id) as outside_count
    FROM check_logs cl
    INNER JOIN (
      SELECT user_id, MAX(timestamp) as latest
      FROM check_logs GROUP BY user_id
    ) latest_cl ON cl.user_id = latest_cl.user_id AND cl.timestamp = latest_cl.latest
    JOIN users u ON cl.user_id = u.id
    WHERE cl.type = 'check-out' AND u.role = 'resident' AND u.status = 'active'
  `);

  const total = totalRes[0].total;
  const outside = outsideRes[0].outside_count;

  // Active leave requests
  const [activeLR] = await pool.execute(
    `SELECT COUNT(*) as count FROM leave_requests WHERE status IN ('approved', 'active')`
  );

  // Current visitors inside
  const [visitorsInside] = await pool.execute(
    `SELECT COUNT(*) as count FROM visitors WHERE status = 'inside'`
  );

  return {
    total_residents: total,
    currently_inside: total - outside,
    currently_outside: outside,
    active_leave_requests: activeLR[0].count,
    visitors_inside: visitorsInside[0].count,
  };
}

async function getVisitors(params, user) {
  const { resident_name, status: visitorStatus } = params;

  let query = `
    SELECT v.name as visitor_name, v.relationship, v.phone, v.purpose,
           v.check_in_time, v.check_out_time, v.status,
           CONCAT(u.first_name, ' ', u.last_name) as resident_name,
           u.student_resident_id
    FROM visitors v
    JOIN users u ON v.visiting_user_id = u.id
    WHERE 1=1
  `;
  const queryParams = [];

  // Role scoping
  if (user.role === 'resident') {
    query += ` AND v.visiting_user_id = ?`;
    queryParams.push(user.id);
  } else if (user.role === 'parent') {
    return { error: 'Parents do not have access to visitor information.' };
  }

  if (resident_name && (isAdmin(user.role) || user.role === 'security_guard')) {
    query += ` AND (CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.student_resident_id LIKE ?)`;
    const searchTerm = `%${resident_name}%`;
    queryParams.push(searchTerm, searchTerm);
  }

  if (visitorStatus) {
    query += ` AND v.status = ?`;
    queryParams.push(visitorStatus);
  }

  query += ` ORDER BY v.check_in_time DESC LIMIT 15`;

  const [visitors] = await pool.execute(query, queryParams);
  return { count: visitors.length, visitors };
}

async function searchResidents(params, user) {
  if (!isAdmin(user.role) && user.role !== 'security_guard') {
    return { error: 'Only admins and security guards can search all residents.' };
  }

  const { query: searchQuery } = params;
  const searchTerm = `%${searchQuery}%`;

  let query = `
    SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as name,
           u.student_resident_id, u.email, u.course, u.year_level, u.gender, u.status,
           r.room_number
    FROM users u
    LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
    LEFT JOIN rooms r ON ra.room_id = r.id
    WHERE u.role = 'resident'
      AND (CONCAT(u.first_name, ' ', u.last_name) LIKE ?
           OR u.student_resident_id LIKE ?
           OR r.room_number LIKE ?)
    LIMIT 10
  `;
  const queryParams = [searchTerm, searchTerm, searchTerm];

  const [residents] = await pool.execute(query, queryParams);

  // Security guards get limited info
  if (user.role === 'security_guard') {
    return {
      count: residents.length,
      residents: residents.map((r) => ({
        name: r.name,
        student_id: r.student_resident_id,
        room: r.room_number,
        status: r.status,
      })),
    };
  }

  return { count: residents.length, residents };
}

// Helper: find residents with role-based filtering
async function findResidents(searchTerm, user) {
  const term = `%${searchTerm}%`;

  let query = `
    SELECT id, first_name, last_name, student_resident_id, email, phone,
           course, year_level, gender, status
    FROM users
    WHERE role = 'resident'
      AND (CONCAT(first_name, ' ', last_name) LIKE ? OR student_resident_id LIKE ?)
  `;
  const params = [term, term];

  // Role scoping
  if (user.role === 'resident') {
    query += ` AND id = ?`;
    params.push(user.id);
  } else if (user.role === 'parent') {
    query += ` AND parent_id = ?`;
    params.push(user.id);
  }

  query += ` LIMIT 5`;

  const [residents] = await pool.execute(query, params);
  return residents;
}

// Map tool names to handler functions
const toolHandlers = {
  check_resident_campus_status: checkResidentCampusStatus,
  get_announcements: getAnnouncements,
  get_leave_requests: getLeaveRequests,
  get_resident_info: getResidentInfo,
  get_room_info: getRoomInfo,
  get_payment_info: getPaymentInfo,
  get_campus_stats: getCampusStats,
  get_visitors: getVisitors,
  search_residents: searchResidents,
};

async function executeTool(toolName, params, user) {
  const handler = toolHandlers[toolName];
  if (!handler) {
    return { error: `Unknown tool: ${toolName}` };
  }

  try {
    return await handler(params, user);
  } catch (error) {
    console.error(`Chatbot tool error (${toolName}):`, error);
    return { error: `Failed to execute ${toolName}: ${error.message}` };
  }
}

module.exports = {
  getToolsForRole,
  executeTool,
};
