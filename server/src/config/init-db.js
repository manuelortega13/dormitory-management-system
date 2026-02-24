const mysql = require('mysql2/promise');
require('dotenv').config();

const initDatabase = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  const fs = require('fs');
  const path = require('path');
  
  const schemaPath = path.join(__dirname, '..', 'config', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  try {
    await connection.query(schema);
    console.log('✅ Database schema initialized successfully');
    
    // Create indexes with error handling (ignore if already exists)
    const indexes = [
      'CREATE INDEX idx_users_role ON users(role)',
      'CREATE INDEX idx_users_status ON users(status)',
      'CREATE INDEX idx_users_parent ON users(parent_id)',
      'CREATE INDEX idx_rooms_status ON rooms(status)',
      'CREATE INDEX idx_room_assignments_status ON room_assignments(status)',
      'CREATE INDEX idx_leave_requests_status ON leave_requests(status)',
      'CREATE INDEX idx_leave_requests_user ON leave_requests(user_id)',
      'CREATE INDEX idx_leave_requests_qr ON leave_requests(qr_code)',
      'CREATE INDEX idx_leave_requests_admin_status ON leave_requests(admin_status)',
      'CREATE INDEX idx_leave_requests_parent_status ON leave_requests(parent_status)',
      'CREATE INDEX idx_check_logs_user ON check_logs(user_id)',
      'CREATE INDEX idx_check_logs_created ON check_logs(created_at)',
      'CREATE INDEX idx_check_logs_leave_request ON check_logs(leave_request_id)',
      'CREATE INDEX idx_visitors_status ON visitors(status)',
      'CREATE INDEX idx_incidents_status ON incidents(status)',
      'CREATE INDEX idx_notifications_user ON notifications(user_id)',
      'CREATE INDEX idx_notifications_read ON notifications(is_read)',
      'CREATE INDEX idx_notifications_created ON notifications(created_at)'
    ];
    
    for (const indexSql of indexes) {
      try {
        await connection.query(indexSql);
      } catch (err) {
        // Ignore duplicate key errors (error code 1061)
        if (err.errno !== 1061) {
          console.warn(`Index warning: ${err.message}`);
        }
      }
    }
    console.log('✅ Database indexes verified');
    
  } catch (error) {
    console.error('❌ Error initializing schema:', error.message);
  } finally {
    await connection.end();
  }
};

module.exports = initDatabase;
