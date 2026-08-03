const { pool } = require('../config/database');

// Helper to check if user has admin-level access
const isAdmin = (role) =>
  ['admin', 'home_dean', 'vpsas'].includes(role);

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
  {
    type: 'function',
    function: {
      name: 'list_occupants',
      description:
        'Get the full list of dormitory occupants (residents). Admins, VPSAS, and business officers see all occupants; home deans see only occupants of their assigned gender. Optionally filter by status or gender.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'suspended'],
            description: 'Filter by occupant status (defaults to active).',
          },
          gender: {
            type: 'string',
            enum: ['male', 'female'],
            description:
              'Filter by gender (ignored for home deans, who are already scoped to their assigned gender).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_unpaid_bills',
      description:
        'List the residents who owe money, with their outstanding balance. Use for questions like "who has unpaid bills", "who is overdue", "who owes the most". Home deans see only their assigned gender.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['unpaid', 'partial', 'overdue', 'all'],
            description:
              'Which bill statuses to count. Defaults to all unsettled bills (unpaid, partial, overdue).',
          },
          type: {
            type: 'string',
            enum: ['rent', 'deposit', 'utility', 'fine', 'other'],
            description: 'Only count bills of this type.',
          },
          overdue_only: {
            type: 'boolean',
            description: 'Only count bills whose due date has already passed.',
          },
          min_outstanding: {
            type: 'number',
            description: 'Only include residents owing at least this amount.',
          },
          sort_by: {
            type: 'string',
            enum: ['outstanding', 'due_date', 'name'],
            description: 'Sort order. Defaults to largest outstanding balance first.',
          },
          limit: {
            type: 'number',
            description: 'Maximum residents to return (default 25, max 100).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_bill_details',
      description:
        'Get the full details of a single bill, including every payment made against it (amount, method, reference number, who verified it and when) and the remaining balance. Pass bill_id when known, otherwise a resident name.',
      parameters: {
        type: 'object',
        properties: {
          bill_id: { type: 'number', description: 'The bill ID, when known.' },
          resident_name: {
            type: 'string',
            description: 'Resident name or student ID, used when the bill ID is unknown.',
          },
          description: {
            type: 'string',
            description: 'Part of the bill description, to narrow down multiple bills.',
          },
          type: {
            type: 'string',
            enum: ['rent', 'deposit', 'utility', 'fine', 'other'],
            description: 'Bill type, to narrow down multiple bills.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_pending_payments',
      description:
        'List payments submitted by residents that are still awaiting verification. Use for "what needs verifying", "any pending payments".',
      parameters: {
        type: 'object',
        properties: {
          resident_name: { type: 'string', description: 'Only this resident’s payments.' },
          payment_method: {
            type: 'string',
            enum: ['cash', 'gcash', 'maya', 'card', 'other'],
            description: 'Filter by payment method.',
          },
          limit: { type: 'number', description: 'Maximum payments to return (default 25, max 100).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_collection_summary',
      description:
        'Billing and collection totals for a period: how much was billed, how much collected (verified), how much is pending verification, plus a breakdown by payment method. Use for "how much did we collect this month".',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['this_month', 'last_month', 'this_year', 'all_time'],
            description: 'Reporting period. Defaults to this_month.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_gatepass_requests',
      description:
        'List gatepass requests and where each one sits in the approval chain (parent, home dean, VPSAS). Use for "which gatepasses need approval", "who is out on a gatepass".',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: [
              'pending_parent',
              'pending_dean',
              'pending_vpsas',
              'approved',
              'active',
              'completed',
              'declined',
              'cancelled',
            ],
            description: 'Filter by gatepass status.',
          },
          awaiting_my_approval: {
            type: 'boolean',
            description:
              'Only gatepasses waiting on the current user’s approval stage (dean queue for home deans, VPSAS queue for VPSAS, any pending stage for admins).',
          },
          resident_name: { type: 'string', description: 'Only this resident’s gatepasses.' },
          limit: { type: 'number', description: 'Maximum gatepasses to return (default 25, max 100).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_room_occupancy',
      description:
        'Room occupancy across the dormitory: capacity, how many are assigned, and how many slots are free. Use for "which rooms are vacant", "how full are we", "any space on the 2nd floor". For one specific room use get_room_info instead.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['available', 'occupied', 'maintenance', 'reserved'],
            description: 'Filter by room status.',
          },
          room_type: {
            type: 'string',
            enum: ['single', 'double', 'triple', 'quad', 'suite'],
            description: 'Filter by room type.',
          },
          floor: { type: 'number', description: 'Filter by floor number.' },
          vacant_only: {
            type: 'boolean',
            description: 'Only rooms with at least one free slot.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tasks',
      description:
        'List disciplinary or assigned tasks and whether they are done. Use for "any pending tasks", "overdue tasks", "what task was assigned to X".',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'overdue'],
            description: 'Filter by task state. "overdue" means still pending past its due date.',
          },
          resident_name: { type: 'string', description: 'Only this resident’s tasks.' },
          limit: { type: 'number', description: 'Maximum tasks to return (default 25, max 100).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_incidents',
      description:
        'List reported incidents. Use for "any unresolved incidents", "recent safety reports", "critical incidents this week".',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['reported', 'investigating', 'resolved', 'closed'],
            description: 'Filter by incident status.',
          },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Filter by severity.',
          },
          incident_type: {
            type: 'string',
            enum: ['safety', 'maintenance', 'behavioral', 'medical', 'other'],
            description: 'Filter by incident type.',
          },
          days: { type: 'number', description: 'Only incidents reported in the last N days.' },
          limit: { type: 'number', description: 'Maximum incidents to return (default 25, max 100).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_check_log_history',
      description:
        'Check-in and check-out history for a resident over time. Use for "when did X last leave", "show me X’s exit history". For present in/out status use check_resident_campus_status instead.',
      parameters: {
        type: 'object',
        properties: {
          resident_name: {
            type: 'string',
            description: 'Resident name or student ID to look up.',
          },
          days: { type: 'number', description: 'Only entries from the last N days (default 30).' },
          limit: { type: 'number', description: 'Maximum entries to return (default 25, max 100).' },
        },
        required: ['resident_name'],
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
    const allowed = [
      'check_resident_campus_status',
      'get_campus_stats',
      'get_visitors',
      'search_residents',
      'get_announcements',
      'get_check_log_history',
    ];
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

  if (role === 'business_officer') {
    // Owns the Payments page, so it gets the billing tools on top of the two it had.
    const allowed = [
      'list_occupants',
      'get_announcements',
      'get_payment_info',
      'list_unpaid_bills',
      'get_bill_details',
      'list_pending_payments',
      'get_collection_summary',
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
  `;
  const queryParams = [searchTerm, searchTerm, searchTerm];

  // Home deans are scoped to their assigned gender here too, matching listOccupants.
  const dean = deanGenderFilter(user);
  query += dean.clause;
  queryParams.push(...dean.params);

  query += ` LIMIT 10`;

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

async function listOccupants(params, user) {
  const allowed = ['admin', 'home_dean', 'vpsas', 'business_officer'];
  if (!allowed.includes(user.role)) {
    return { error: 'You do not have access to the occupant list.' };
  }

  const { status, gender } = params || {};

  let query = `
    SELECT CONCAT(u.first_name, ' ', u.last_name) as name, u.student_resident_id,
           u.gender, u.course, u.year_level, u.status, r.room_number
    FROM users u
    LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
    LEFT JOIN rooms r ON ra.room_id = r.id
    WHERE u.role = 'resident'
  `;
  const queryParams = [];

  // Home deans only see occupants of their assigned gender.
  if (user.role === 'home_dean' && user.deanType) {
    query += ` AND u.gender = ?`;
    queryParams.push(user.deanType);
  } else if (gender) {
    query += ` AND u.gender = ?`;
    queryParams.push(gender);
  }

  if (status) {
    query += ` AND u.status = ?`;
    queryParams.push(status);
  } else {
    query += ` AND u.status = 'active'`;
  }

  query += ` ORDER BY u.last_name, u.first_name LIMIT 200`;

  const [occupants] = await pool.execute(query, queryParams);
  return { count: occupants.length, occupants };
}

// --- Helpers shared by the tools below ---

// Payments-facing tools. business_officer owns the Payments page, so it belongs here
// even though isAdmin() (used for dormitory administration) excludes it.
const isPaymentsStaff = (role) => isAdmin(role) || role === 'business_officer';

// Home deans are scoped to their assigned gender. Every tool that can surface
// residents must apply this, or a dean sees the other dormitory's students.
function deanGenderFilter(user, alias = 'u') {
  if (user.role === 'home_dean' && user.deanType) {
    return { clause: ` AND ${alias}.gender = ?`, params: [user.deanType] };
  }
  return { clause: '', params: [] };
}

// Keep result sets (and therefore token usage) bounded regardless of what the model asks for.
function clampLimit(limit, fallback = 25, max = 100) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

const sumAmounts = (rows) => rows.reduce((total, row) => total + Number(row.amount || 0), 0);

async function listUnpaidBills(params, user) {
  if (!isPaymentsStaff(user.role)) {
    return { error: 'Only admins and business officers can view outstanding balances.' };
  }

  const { status, type, overdue_only, min_outstanding, sort_by, limit } = params || {};
  const statuses = status && status !== 'all' ? [status] : ['unpaid', 'partial', 'overdue'];

  // Payments are aggregated in a derived table on purpose: joining them directly
  // would multiply each bill's amount by its number of payment rows.
  let query = `
    SELECT u.id as resident_id,
           CONCAT(u.first_name, ' ', u.last_name) as resident_name,
           u.student_resident_id, u.gender, u.status as resident_status, r.room_number,
           COUNT(b.id) as bill_count,
           SUM(b.amount) as total_billed,
           COALESCE(SUM(paid.paid_amount), 0) as total_paid,
           SUM(b.amount) - COALESCE(SUM(paid.paid_amount), 0) as outstanding,
           MIN(b.due_date) as oldest_due_date,
           SUM(CASE WHEN b.due_date < CURDATE() THEN 1 ELSE 0 END) as overdue_bills
    FROM bills b
    JOIN users u ON b.resident_id = u.id
    LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
    LEFT JOIN rooms r ON ra.room_id = r.id
    LEFT JOIN (
      SELECT bill_id, SUM(amount) as paid_amount
      FROM payments
      WHERE status IN ('verified', 'pending')
      GROUP BY bill_id
    ) paid ON paid.bill_id = b.id
    WHERE b.status IN (${statuses.map(() => '?').join(',')})
  `;
  const queryParams = [...statuses];

  if (type) {
    query += ` AND b.type = ?`;
    queryParams.push(type);
  }
  if (overdue_only) {
    query += ` AND b.due_date < CURDATE()`;
  }

  const dean = deanGenderFilter(user);
  query += dean.clause;
  queryParams.push(...dean.params);

  query += `
    GROUP BY u.id, u.first_name, u.last_name, u.student_resident_id, u.gender, u.status, r.room_number
    HAVING outstanding > 0
  `;

  if (min_outstanding) {
    query += ` AND outstanding >= ?`;
    queryParams.push(min_outstanding);
  }

  const sorts = {
    outstanding: 'outstanding DESC',
    due_date: 'oldest_due_date ASC',
    name: 'resident_name ASC',
  };
  query += ` ORDER BY ${sorts[sort_by] || sorts.outstanding} LIMIT ${clampLimit(limit)}`;

  const [rows] = await pool.query(query, queryParams);
  return {
    count: rows.length,
    total_outstanding: rows.reduce((total, r) => total + Number(r.outstanding), 0),
    students: rows,
  };
}

async function getBillDetails(params, user) {
  if (!isPaymentsStaff(user.role)) {
    return { error: 'Only admins and business officers can view full bill details.' };
  }

  const { bill_id, resident_name, description, type } = params || {};
  if (!bill_id && !resident_name) {
    return { error: 'Provide a bill_id, or a resident name to look up their bills.' };
  }

  let query = `
    SELECT b.id as bill_id, b.type, b.description, b.amount, b.due_date, b.status,
           b.created_at, b.updated_at,
           CONCAT(u.first_name, ' ', u.last_name) as resident_name,
           u.student_resident_id, u.gender, r.room_number,
           CONCAT(c.first_name, ' ', c.last_name) as created_by_name
    FROM bills b
    JOIN users u ON b.resident_id = u.id
    LEFT JOIN users c ON b.created_by = c.id
    LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
    LEFT JOIN rooms r ON ra.room_id = r.id
    WHERE 1 = 1
  `;
  const queryParams = [];

  if (bill_id) {
    query += ` AND b.id = ?`;
    queryParams.push(bill_id);
  }
  if (resident_name) {
    query += ` AND (CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.student_resident_id LIKE ?)`;
    queryParams.push(`%${resident_name}%`, `%${resident_name}%`);
  }
  if (description) {
    query += ` AND b.description LIKE ?`;
    queryParams.push(`%${description}%`);
  }
  if (type) {
    query += ` AND b.type = ?`;
    queryParams.push(type);
  }

  const dean = deanGenderFilter(user);
  query += dean.clause;
  queryParams.push(...dean.params);

  query += ` ORDER BY b.due_date DESC LIMIT 10`;

  const [bills] = await pool.query(query, queryParams);
  if (bills.length === 0) {
    return { found: false, message: 'No matching bill found.' };
  }

  // Several matches: hand back the candidates so the assistant can ask which one.
  if (bills.length > 1) {
    return {
      found: true,
      needs_disambiguation: true,
      count: bills.length,
      candidates: bills.map((b) => ({
        bill_id: b.bill_id,
        resident_name: b.resident_name,
        type: b.type,
        description: b.description,
        amount: b.amount,
        due_date: b.due_date,
        status: b.status,
      })),
    };
  }

  const bill = bills[0];
  const [payments] = await pool.execute(
    `SELECT p.id as payment_id, p.amount, p.payment_method, p.reference_number, p.notes,
            p.status, p.payment_date, p.created_at, p.verified_at,
            (p.receipt_image IS NOT NULL AND p.receipt_image != '') as has_receipt,
            CONCAT(payer.first_name, ' ', payer.last_name) as paid_by_name,
            CONCAT(v.first_name, ' ', v.last_name) as verified_by_name
     FROM payments p
     LEFT JOIN users payer ON p.paid_by = payer.id
     LEFT JOIN users v ON p.verified_by = v.id
     WHERE p.bill_id = ?
     ORDER BY p.created_at DESC`,
    [bill.bill_id]
  );

  const verifiedPaid = sumAmounts(payments.filter((p) => p.status === 'verified'));
  const pendingPaid = sumAmounts(payments.filter((p) => p.status === 'pending'));

  return {
    found: true,
    bill,
    totals: {
      bill_amount: Number(bill.amount),
      verified_paid: verifiedPaid,
      pending_paid: pendingPaid,
      // Counts pending payments, matching how the Payments page computes remaining balance.
      remaining: Number(bill.amount) - verifiedPaid - pendingPaid,
      payment_count: payments.length,
    },
    payments,
  };
}

async function listPendingPayments(params, user) {
  if (!isPaymentsStaff(user.role)) {
    return { error: 'Only admins and business officers can view the verification queue.' };
  }

  const { resident_name, payment_method, limit } = params || {};

  let query = `
    SELECT p.id as payment_id, p.amount, p.payment_method, p.reference_number,
           p.payment_date, p.created_at as submitted_at,
           DATEDIFF(CURDATE(), DATE(p.created_at)) as days_waiting,
           (p.receipt_image IS NOT NULL AND p.receipt_image != '') as has_receipt,
           b.id as bill_id, b.description as bill_description, b.amount as bill_amount,
           b.due_date, b.type as bill_type,
           CONCAT(u.first_name, ' ', u.last_name) as resident_name,
           u.student_resident_id, r.room_number
    FROM payments p
    JOIN bills b ON p.bill_id = b.id
    JOIN users u ON p.resident_id = u.id
    LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
    LEFT JOIN rooms r ON ra.room_id = r.id
    WHERE p.status = 'pending'
  `;
  const queryParams = [];

  if (resident_name) {
    query += ` AND (CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.student_resident_id LIKE ?)`;
    queryParams.push(`%${resident_name}%`, `%${resident_name}%`);
  }
  if (payment_method) {
    query += ` AND p.payment_method = ?`;
    queryParams.push(payment_method);
  }

  const dean = deanGenderFilter(user);
  query += dean.clause;
  queryParams.push(...dean.params);

  query += ` ORDER BY p.created_at ASC LIMIT ${clampLimit(limit)}`;

  const [payments] = await pool.query(query, queryParams);
  return {
    count: payments.length,
    total_pending_amount: sumAmounts(payments),
    payments,
  };
}

async function getCollectionSummary(params, user) {
  if (!isPaymentsStaff(user.role)) {
    return { error: 'Only admins and business officers can view collection summaries.' };
  }

  const period = (params || {}).period || 'this_month';
  // Enum-mapped, never interpolated from raw input.
  const ranges = {
    this_month: 'YEAR(#) = YEAR(CURDATE()) AND MONTH(#) = MONTH(CURDATE())',
    last_month:
      'YEAR(#) = YEAR(CURDATE() - INTERVAL 1 MONTH) AND MONTH(#) = MONTH(CURDATE() - INTERVAL 1 MONTH)',
    this_year: 'YEAR(#) = YEAR(CURDATE())',
    all_time: '1 = 1',
  };
  const range = ranges[period] || ranges.this_month;
  const paymentWhere = range.replace(/#/g, 'p.created_at');
  const billWhere = range.replace(/#/g, 'b.created_at');

  const dean = deanGenderFilter(user);

  const [[billed]] = await pool.query(
    `SELECT COUNT(*) as bill_count, COALESCE(SUM(b.amount), 0) as total_billed
     FROM bills b JOIN users u ON b.resident_id = u.id
     WHERE ${billWhere}${dean.clause}`,
    [...dean.params]
  );

  const [byStatus] = await pool.query(
    `SELECT p.status, COUNT(*) as payment_count, COALESCE(SUM(p.amount), 0) as total
     FROM payments p JOIN users u ON p.resident_id = u.id
     WHERE ${paymentWhere}${dean.clause}
     GROUP BY p.status`,
    [...dean.params]
  );

  const [byMethod] = await pool.query(
    `SELECT p.payment_method, COUNT(*) as payment_count, COALESCE(SUM(p.amount), 0) as total
     FROM payments p JOIN users u ON p.resident_id = u.id
     WHERE p.status = 'verified' AND ${paymentWhere}${dean.clause}
     GROUP BY p.payment_method
     ORDER BY total DESC`,
    [...dean.params]
  );

  const pick = (status) => byStatus.find((row) => row.status === status) || { payment_count: 0, total: 0 };

  return {
    period,
    billed: { bill_count: billed.bill_count, total_billed: Number(billed.total_billed) },
    collected: {
      verified_total: Number(pick('verified').total),
      verified_count: pick('verified').payment_count,
    },
    awaiting_verification: {
      pending_total: Number(pick('pending').total),
      pending_count: pick('pending').payment_count,
    },
    rejected: { rejected_count: pick('rejected').payment_count },
    by_payment_method: byMethod,
  };
}

async function getGatepassRequests(params, user) {
  if (!isAdmin(user.role)) {
    return { error: 'Only admins, home deans, and VPSAS can view gatepass requests.' };
  }

  const { status, awaiting_my_approval, resident_name, limit } = params || {};

  let query = `
    SELECT g.id as gatepass_id, g.reason, g.destination, g.status,
           g.parent_status, g.dean_status, g.vpsas_status,
           g.exit_time, g.return_time, g.deadline, g.disciplinary_status, g.created_at,
           CONCAT(u.first_name, ' ', u.last_name) as resident_name,
           u.student_resident_id, u.gender, r.room_number
    FROM gatepasses g
    JOIN users u ON g.user_id = u.id
    LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
    LEFT JOIN rooms r ON ra.room_id = r.id
    WHERE 1 = 1
  `;
  const queryParams = [];

  if (status) {
    query += ` AND g.status = ?`;
    queryParams.push(status);
  }

  if (awaiting_my_approval) {
    if (user.role === 'home_dean') {
      query += ` AND g.status = 'pending_dean'`;
    } else if (user.role === 'vpsas') {
      query += ` AND g.status = 'pending_vpsas'`;
    } else {
      query += ` AND g.status IN ('pending_parent', 'pending_dean', 'pending_vpsas')`;
    }
  }

  if (resident_name) {
    query += ` AND (CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.student_resident_id LIKE ?)`;
    queryParams.push(`%${resident_name}%`, `%${resident_name}%`);
  }

  const dean = deanGenderFilter(user);
  query += dean.clause;
  queryParams.push(...dean.params);

  query += ` ORDER BY g.created_at DESC LIMIT ${clampLimit(limit)}`;

  const [gatepasses] = await pool.query(query, queryParams);
  return { count: gatepasses.length, gatepasses };
}

async function getRoomOccupancy(params, user) {
  if (!isAdmin(user.role)) {
    return { error: 'Only admins, home deans, and VPSAS can view room occupancy.' };
  }

  const { status, room_type, floor, vacant_only } = params || {};

  let query = `
    SELECT r.id as room_id, r.room_number, r.floor, r.capacity, r.room_type, r.status,
           r.price_per_month,
           COUNT(ra.id) as occupants,
           (r.capacity - COUNT(ra.id)) as free_slots
    FROM rooms r
    LEFT JOIN room_assignments ra ON ra.room_id = r.id AND ra.status = 'active'
    WHERE 1 = 1
  `;
  const queryParams = [];

  if (status) {
    query += ` AND r.status = ?`;
    queryParams.push(status);
  }
  if (room_type) {
    query += ` AND r.room_type = ?`;
    queryParams.push(room_type);
  }
  if (floor !== undefined && floor !== null) {
    query += ` AND r.floor = ?`;
    queryParams.push(floor);
  }

  query += ` GROUP BY r.id, r.room_number, r.floor, r.capacity, r.room_type, r.status, r.price_per_month`;
  if (vacant_only) {
    query += ` HAVING free_slots > 0`;
  }
  query += ` ORDER BY r.floor, r.room_number LIMIT 200`;

  const [rooms] = await pool.query(query, queryParams);
  const totalCapacity = rooms.reduce((total, r) => total + Number(r.capacity), 0);
  const totalOccupants = rooms.reduce((total, r) => total + Number(r.occupants), 0);

  return {
    count: rooms.length,
    totals: {
      capacity: totalCapacity,
      occupants: totalOccupants,
      free_slots: totalCapacity - totalOccupants,
      occupancy_rate:
        totalCapacity > 0 ? `${Math.round((totalOccupants / totalCapacity) * 100)}%` : 'n/a',
    },
    rooms,
  };
}

async function getTasks(params, user) {
  if (!isAdmin(user.role)) {
    return { error: 'Only admins, home deans, and VPSAS can view assigned tasks.' };
  }

  const { status, resident_name, limit } = params || {};

  let query = `
    SELECT t.id as task_id, t.title, t.description, t.due_date, t.status,
           t.completed_at, t.completion_note, t.created_at,
           (t.completion_image IS NOT NULL AND t.completion_image != '') as has_proof_image,
           CONCAT(u.first_name, ' ', u.last_name) as resident_name,
           u.student_resident_id, u.gender,
           CONCAT(a.first_name, ' ', a.last_name) as assigned_by_name
    FROM tasks t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN users a ON t.assigned_by = a.id
    WHERE 1 = 1
  `;
  const queryParams = [];

  if (status === 'overdue') {
    query += ` AND t.status = 'pending' AND t.due_date < CURDATE()`;
  } else if (status) {
    query += ` AND t.status = ?`;
    queryParams.push(status);
  }

  if (resident_name) {
    query += ` AND (CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.student_resident_id LIKE ?)`;
    queryParams.push(`%${resident_name}%`, `%${resident_name}%`);
  }

  const dean = deanGenderFilter(user);
  query += dean.clause;
  queryParams.push(...dean.params);

  query += ` ORDER BY t.due_date ASC LIMIT ${clampLimit(limit)}`;

  const [tasks] = await pool.query(query, queryParams);
  return { count: tasks.length, tasks };
}

async function getIncidents(params, user) {
  if (!isAdmin(user.role)) {
    return { error: 'Only admins, home deans, and VPSAS can view incident reports.' };
  }

  const { status, severity, incident_type, days, limit } = params || {};

  let query = `
    SELECT i.id as incident_id, i.title, i.description, i.incident_type, i.severity,
           i.status, i.location, i.involved_users, i.resolved_at, i.resolution_notes,
           i.created_at,
           CONCAT(rep.first_name, ' ', rep.last_name) as reported_by_name,
           CONCAT(res.first_name, ' ', res.last_name) as resolved_by_name
    FROM incidents i
    LEFT JOIN users rep ON i.reported_by = rep.id
    LEFT JOIN users res ON i.resolved_by = res.id
    WHERE 1 = 1
  `;
  const queryParams = [];

  if (status) {
    query += ` AND i.status = ?`;
    queryParams.push(status);
  }
  if (severity) {
    query += ` AND i.severity = ?`;
    queryParams.push(severity);
  }
  if (incident_type) {
    query += ` AND i.incident_type = ?`;
    queryParams.push(incident_type);
  }
  if (days) {
    query += ` AND i.created_at >= CURDATE() - INTERVAL ? DAY`;
    queryParams.push(clampLimit(days, 30, 365));
  }

  query += ` ORDER BY i.created_at DESC LIMIT ${clampLimit(limit)}`;

  const [incidents] = await pool.query(query, queryParams);
  return { count: incidents.length, incidents };
}

async function getCheckLogHistory(params, user) {
  if (!isAdmin(user.role) && user.role !== 'security_guard') {
    return { error: 'Only admins and security guards can view check-in/out history.' };
  }

  const { resident_name, days, limit } = params || {};
  if (!resident_name) {
    return { error: 'Provide a resident name or student ID.' };
  }

  const dean = deanGenderFilter(user);
  const query = `
    SELECT c.id as log_id, c.type, c.timestamp, c.method, c.notes,
           c.leave_request_id, c.gatepass_id,
           CONCAT(u.first_name, ' ', u.last_name) as resident_name,
           u.student_resident_id,
           CONCAT(rb.first_name, ' ', rb.last_name) as recorded_by_name
    FROM check_logs c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN users rb ON c.recorded_by = rb.id
    WHERE (CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.student_resident_id LIKE ?)
      AND c.timestamp >= CURDATE() - INTERVAL ? DAY${dean.clause}
    ORDER BY c.timestamp DESC
    LIMIT ${clampLimit(limit)}
  `;
  const [logs] = await pool.query(query, [
    `%${resident_name}%`,
    `%${resident_name}%`,
    clampLimit(days, 30, 365),
    ...dean.params,
  ]);

  return { count: logs.length, logs };
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
  } else if (user.role === 'home_dean' && user.deanType) {
    // Same scope listOccupants applies; without it a dean could look up a name
    // from the other dormitory.
    query += ` AND gender = ?`;
    params.push(user.deanType);
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
  list_occupants: listOccupants,
  list_unpaid_bills: listUnpaidBills,
  get_bill_details: getBillDetails,
  list_pending_payments: listPendingPayments,
  get_collection_summary: getCollectionSummary,
  get_gatepass_requests: getGatepassRequests,
  get_room_occupancy: getRoomOccupancy,
  get_tasks: getTasks,
  get_incidents: getIncidents,
  get_check_log_history: getCheckLogHistory,
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
