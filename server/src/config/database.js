const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dormitory_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Use UTC for all date/time operations
  timezone: 'Z'
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Test database connection with retry/backoff.
// Railway's private network (mysql.railway.internal) can take a few seconds to become
// available at container startup, so we retry instead of exiting on the first failure.
// Only after exhausting all attempts do we exit (so a genuinely misconfigured DB still
// fails the deploy rather than hanging forever).
const testConnection = async () => {
  const maxAttempts = parseInt(process.env.DB_CONNECT_RETRIES, 10) || 10;
  const retryDelayMs = parseInt(process.env.DB_CONNECT_RETRY_DELAY_MS, 10) || 3000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const connection = await pool.getConnection();
      console.log('✅ MySQL Database connected successfully');
      connection.release();
      return;
    } catch (error) {
      console.error(
        `❌ Database connection failed (attempt ${attempt}/${maxAttempts}): ${error.message}`
      );
      if (attempt === maxAttempts) {
        console.error('❌ Exhausted all database connection attempts. Exiting.');
        process.exit(1);
      }
      await sleep(retryDelayMs);
    }
  }
};

module.exports = { pool, testConnection };
