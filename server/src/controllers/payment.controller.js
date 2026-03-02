const { pool } = require('../config/database');
const { sendNotificationToUser } = require('../services/socket.service');

// ==================== BILLS ====================

// Get all bills (admin view)
exports.getAllBills = async (req, res) => {
  try {
    const { status, type, resident_id } = req.query;

    let query = `
      SELECT b.*, 
             u.first_name, u.last_name, u.student_resident_id,
             CONCAT(u.first_name, ' ', u.last_name) as resident_name,
             r.room_number,
             COALESCE(SUM(p.amount), 0) as total_paid
      FROM bills b
      JOIN users u ON b.resident_id = u.id
      LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
      LEFT JOIN rooms r ON ra.room_id = r.id
      LEFT JOIN payments p ON b.id = p.bill_id AND p.status IN ('verified', 'pending')
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND b.status = ?';
      params.push(status);
    }

    if (type) {
      query += ' AND b.type = ?';
      params.push(type);
    }

    if (resident_id) {
      query += ' AND b.resident_id = ?';
      params.push(resident_id);
    }

    query += ' GROUP BY b.id, r.room_number ORDER BY b.due_date DESC';

    const [bills] = await pool.execute(query, params);

    // Calculate remaining balance for each bill
    const billsWithBalance = bills.map(bill => ({
      ...bill,
      amount_paid: parseFloat(bill.total_paid) || 0,
      remaining_balance: parseFloat(bill.amount) - parseFloat(bill.total_paid)
    }));

    res.json({ success: true, data: billsWithBalance });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
};

// Get bills for a specific resident (resident/parent view)
exports.getResidentBills = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    let residentId;

    if (userRole === 'parent') {
      // Get the parent's child ID from users table (parent_id in resident's record points to the parent)
      const [children] = await pool.execute(
        `SELECT id as resident_id FROM users WHERE parent_id = ? AND role = 'resident'`,
        [userId]
      );
      if (children.length === 0 || !children[0].resident_id) {
        return res.json({ success: true, data: [] });
      }
      residentId = children[0].resident_id;
    } else {
      residentId = userId;
    }

    const [bills] = await pool.execute(
      `SELECT b.*, 
              CONCAT(u.first_name, ' ', u.last_name) as resident_name,
              COALESCE(SUM(p.amount), 0) as total_paid
       FROM bills b
       JOIN users u ON b.resident_id = u.id
       LEFT JOIN payments p ON b.id = p.bill_id AND p.status IN ('verified', 'pending')
       WHERE b.resident_id = ?
       GROUP BY b.id
       ORDER BY b.due_date DESC`,
      [residentId]
    );

    const billsWithBalance = bills.map(bill => ({
      ...bill,
      amount_paid: parseFloat(bill.total_paid) || 0,
      remaining_balance: parseFloat(bill.amount) - parseFloat(bill.total_paid)
    }));

    res.json({ success: true, data: billsWithBalance });
  } catch (error) {
    console.error('Get resident bills error:', error);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
};

// Create a new bill (admin only)
exports.createBill = async (req, res) => {
  try {
    const { resident_id, type, description, amount, due_date } = req.body;
    const createdBy = req.user.id;

    if (!resident_id || !description || !amount || !due_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [result] = await pool.execute(
      `INSERT INTO bills (resident_id, type, description, amount, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [resident_id, type || 'rent', description, amount, due_date, createdBy]
    );

    // Notify resident about new bill
    sendNotificationToUser(resident_id, {
      id: Date.now(),
      user_id: resident_id,
      type: 'payment',
      title: '💰 New Bill',
      message: `A new ${type || 'rent'} bill of ₱${parseFloat(amount).toLocaleString()} has been added. Due: ${due_date}`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    const createdBill = {
      id: result.insertId,
      resident_id,
      type: type || 'rent',
      description,
      amount,
      due_date,
      status: 'unpaid',
      created_at: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: createdBill
    });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ error: 'Failed to create bill' });
  }
};

// Update bill (admin only)
exports.updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, description, amount, due_date, status } = req.body;

    const [existing] = await pool.execute('SELECT * FROM bills WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    await pool.execute(
      `UPDATE bills SET type = ?, description = ?, amount = ?, due_date = ?, status = ?
       WHERE id = ?`,
      [
        type || existing[0].type,
        description || existing[0].description,
        amount || existing[0].amount,
        due_date || existing[0].due_date,
        status || existing[0].status,
        id
      ]
    );

    res.json({ message: 'Bill updated successfully' });
  } catch (error) {
    console.error('Update bill error:', error);
    res.status(500).json({ error: 'Failed to update bill' });
  }
};

// Delete bill (admin only)
exports.deleteBill = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute('DELETE FROM bills WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    res.json({ message: 'Bill deleted successfully' });
  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({ error: 'Failed to delete bill' });
  }
};

// ==================== PAYMENTS ====================

// Get all payments (admin view)
exports.getAllPayments = async (req, res) => {
  try {
    const { status, payment_method, bill_id, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const offset = (pageNum - 1) * pageLimit;

    const params = [];
    let whereConditions = [];

    if (status) {
      whereConditions.push('p.status = ?');
      params.push(status);
    }

    if (payment_method) {
      whereConditions.push('p.payment_method = ?');
      params.push(payment_method);
    }

    if (bill_id) {
      whereConditions.push('p.bill_id = ?');
      params.push(bill_id);
    }

    const whereClause = whereConditions.length > 0 ? ' WHERE ' + whereConditions.join(' AND ') : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM payments p${whereClause}`;
    const [[{ total }]] = await pool.execute(countQuery, params);

    // Get paginated results
    const dataQuery = `
      SELECT p.*, 
             b.type as bill_type, b.description as bill_description, b.amount as bill_amount,
             u.first_name as resident_first_name, u.last_name as resident_last_name,
             CONCAT(u.first_name, ' ', u.last_name) as resident_name,
             payer.first_name as payer_first_name, payer.last_name as payer_last_name,
             CONCAT(payer.first_name, ' ', payer.last_name) as payer_name,
             r.room_number
      FROM payments p
      JOIN bills b ON p.bill_id = b.id
      JOIN users u ON p.resident_id = u.id
      JOIN users payer ON p.paid_by = payer.id
      LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
      LEFT JOIN rooms r ON ra.room_id = r.id
      ${whereClause}
      ORDER BY p.payment_date DESC
      LIMIT ? OFFSET ?
    `;
    
    const dataParams = [...params, Number(pageLimit), Number(offset)];
    console.log('getAllPayments dataQuery:', dataQuery);
    console.log('getAllPayments dataParams:', dataParams);
    const [payments] = await pool.query(dataQuery, dataParams);
    
    const totalPages = Math.ceil(total / pageLimit);

    res.json({ 
      success: true, 
      data: payments,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        total: total,
        pages: totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

// Get payments for a specific resident
exports.getResidentPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const offset = (pageNum - 1) * pageLimit;
    
    let residentId;

    if (userRole === 'parent') {
      // Get the parent's child ID from users table (parent_id in resident's record points to the parent)
      const [children] = await pool.execute(
        `SELECT id as resident_id FROM users WHERE parent_id = ? AND role = 'resident'`,
        [userId]
      );
      if (children.length === 0 || !children[0].resident_id) {
        return res.json({ 
          success: true, 
          data: [],
          pagination: {
            page: pageNum,
            limit: pageLimit,
            total: 0,
            pages: 0,
            hasNextPage: false,
            hasPrevPage: false
          }
        });
      }
      residentId = children[0].resident_id;
    } else {
      residentId = userId;
    }

    // Get total count
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) as total FROM payments WHERE resident_id = ?`,
      [residentId]
    );

    const [payments] = await pool.query(
      `SELECT p.*, 
              b.type as bill_type, b.description as bill_description,
              payer.first_name as payer_first_name, payer.last_name as payer_last_name,
              CONCAT(payer.first_name, ' ', payer.last_name) as payer_name
       FROM payments p
       JOIN bills b ON p.bill_id = b.id
       JOIN users payer ON p.paid_by = payer.id
       WHERE p.resident_id = ?
       ORDER BY p.payment_date DESC
       LIMIT ? OFFSET ?`,
      [residentId, pageLimit, offset]
    );

    const totalPages = Math.ceil(total / pageLimit);

    res.json({ 
      success: true, 
      data: payments,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        total: total,
        pages: totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get resident payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

// Make a payment (resident or parent)
exports.makePayment = async (req, res) => {
  try {
    const { bill_id, amount, payment_method, reference_number, notes, receipt_image } = req.body;
    const paidBy = req.user.id;
    const userRole = req.user.role;

    if (!bill_id || !amount || !payment_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get the bill
    const [bills] = await pool.execute('SELECT * FROM bills WHERE id = ?', [bill_id]);
    if (bills.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const bill = bills[0];
    let residentId = bill.resident_id;

    // If parent, verify they can pay for this resident
    if (userRole === 'parent') {
      const [parentLink] = await pool.execute(
        `SELECT * FROM users WHERE id = ? AND parent_id = ? AND role = 'parent' AND registration_status = 'approved'`,
        [paidBy, residentId]
      );
      if (parentLink.length === 0) {
        return res.status(403).json({ error: 'You are not authorized to pay for this resident' });
      }
    } else if (userRole === 'resident' && residentId !== paidBy) {
      return res.status(403).json({ error: 'You can only pay for your own bills' });
    }

    // Check if there's already sufficient payment for this bill (verified + pending)
    const [existingPayments] = await pool.execute(
      `SELECT COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0) as total_amount FROM payments WHERE bill_id = ? AND status IN ('verified', 'pending')`,
      [bill_id]
    );

    const billAmount = parseFloat(bill.amount);
    const totalExistingPayment = parseFloat(existingPayments[0]?.total_amount || 0);
    const paymentAmount = parseFloat(amount);
    const remainingBalance = billAmount - totalExistingPayment;

    // Reject if there's already sufficient payment covering the bill
    if (remainingBalance <= 0) {
      return res.status(400).json({ 
        error: 'This bill has already been paid or has sufficient pending payment for verification',
        details: {
          bill_amount: billAmount,
          total_paid_and_pending: totalExistingPayment,
          remaining_balance: remainingBalance
        }
      });
    }

    // Reject if new payment would exceed remaining balance
    if (paymentAmount > remainingBalance) {
      return res.status(400).json({ 
        error: 'Payment amount exceeds remaining balance',
        details: {
          remaining_balance: remainingBalance,
          requested_amount: paymentAmount
        }
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO payments (bill_id, resident_id, paid_by, amount, payment_method, reference_number, notes, receipt_image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [bill_id, residentId, paidBy, amount, payment_method, reference_number || null, notes || null, receipt_image || null]
    );

    // Notify admins about new payment
    const [admins] = await pool.execute(
      `SELECT id FROM users WHERE role IN ('admin', 'home_dean_men', 'home_dean_women')`
    );

    const [payer] = await pool.execute(
      `SELECT first_name, last_name FROM users WHERE id = ?`,
      [paidBy]
    );

    const payerName = payer.length > 0 ? `${payer[0].first_name} ${payer[0].last_name}` : 'Unknown';

    for (const admin of admins) {
      sendNotificationToUser(admin.id, {
        id: Date.now() + admin.id,
        user_id: admin.id,
        type: 'payment',
        title: '💳 New Payment',
        message: `${payerName} made a payment of ₱${parseFloat(amount).toLocaleString()} for ${bill.description}`,
        is_read: false,
        created_at: new Date().toISOString()
      });
    }

    res.status(201).json({
      message: 'Payment submitted successfully. Awaiting verification.',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Make payment error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
};

// Verify payment (admin only)
exports.verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const verifiedBy = req.user.id;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const [existing] = await pool.execute('SELECT * FROM payments WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    await pool.execute(
      `UPDATE payments SET status = ?, verified_by = ?, verified_at = NOW() WHERE id = ?`,
      [status, verifiedBy, id]
    );

    // If verified, update bill status
    if (status === 'verified') {
      const payment = existing[0];
      
      // Get total verified payments for this bill
      const [totals] = await pool.execute(
        `SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE bill_id = ? AND status = 'verified'`,
        [payment.bill_id]
      );
      
      const [bill] = await pool.execute('SELECT * FROM bills WHERE id = ?', [payment.bill_id]);
      
      if (bill.length > 0) {
        const totalPaid = parseFloat(totals[0].total_paid) + parseFloat(payment.amount);
        const billAmount = parseFloat(bill[0].amount);
        
        let newStatus = 'partial';
        if (totalPaid >= billAmount) {
          newStatus = 'paid';
        }
        
        await pool.execute('UPDATE bills SET status = ? WHERE id = ?', [newStatus, payment.bill_id]);
      }
    }

    // Notify payer about verification status
    const notifTitle = status === 'verified' ? 'Payment Verified' : 'Payment Rejected';
    const notifMessage = status === 'verified' 
      ? `Your payment of ₱${parseFloat(existing[0].amount).toLocaleString()} has been verified.`
      : `Your payment of ₱${parseFloat(existing[0].amount).toLocaleString()} has been rejected. Please contact admin.`;
    
    // Save notification to database
    await pool.execute(
      `INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)`,
      [existing[0].paid_by, 'payment', notifTitle, notifMessage]
    );
    
    // Send real-time notification
    sendNotificationToUser(existing[0].paid_by, {
      id: Date.now(),
      user_id: existing[0].paid_by,
      type: 'payment',
      title: status === 'verified' ? '✅ Payment Verified' : '❌ Payment Rejected',
      message: notifMessage,
      is_read: false,
      created_at: new Date().toISOString()
    });

    res.json({ message: `Payment ${status} successfully` });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

// Get payment stats (admin)
exports.getStats = async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'verified') as total_collected,
        (SELECT COUNT(*) FROM bills WHERE status IN ('unpaid', 'partial')) as pending_bills,
        (SELECT COUNT(*) FROM bills WHERE status = 'overdue') as overdue_bills,
        (SELECT COUNT(*) FROM payments WHERE status = 'pending') as pending_payments,
        (SELECT COALESCE(SUM(amount), 0) FROM bills WHERE status IN ('unpaid', 'partial', 'overdue')) as total_receivable
    `);

    res.json({ success: true, data: stats[0] });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// Get residents list for bill creation dropdown
exports.getResidents = async (req, res) => {
  try {
    const [residents] = await pool.execute(
      `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as name, u.email, u.student_resident_id, r.room_number
       FROM users u
       LEFT JOIN room_assignments ra ON u.id = ra.user_id AND ra.status = 'active'
       LEFT JOIN rooms r ON ra.room_id = r.id
       WHERE u.role = 'resident' AND u.status = 'active'
       ORDER BY u.last_name, u.first_name`
    );

    res.json({ success: true, data: residents });
  } catch (error) {
    console.error('Get residents error:', error);
    res.status(500).json({ error: 'Failed to fetch residents' });
  }
};

// ==================== PAYMENT SETTINGS ====================

// Get all payment settings (public - for displaying recipient info)
exports.getPaymentSettings = async (req, res) => {
  try {
    const [settings] = await pool.execute(
      `SELECT setting_key, setting_value, description FROM payment_settings`
    );

    // Convert to key-value object for easier frontend use
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.setting_key] = s.setting_value;
    });

    res.json({ success: true, data: settingsObj });
  } catch (error) {
    console.error('Get payment settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payment settings' });
  }
};

// Update payment settings (admin only)
exports.updatePaymentSettings = async (req, res) => {
  try {
    const settings = req.body;
    const adminId = req.user.id;

    const allowedKeys = [
      'gcash_number', 'gcash_name',
      'maya_number', 'maya_name',
      'cash_instructions', 'payment_notes'
    ];

    for (const [key, value] of Object.entries(settings)) {
      if (allowedKeys.includes(key)) {
        await pool.execute(
          `UPDATE payment_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?`,
          [value || '', adminId, key]
        );
      }
    }

    res.json({ success: true, message: 'Payment settings updated successfully' });
  } catch (error) {
    console.error('Update payment settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to update payment settings' });
  }
};
