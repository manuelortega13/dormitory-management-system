const mysql = require('mysql2/promise');
require('dotenv').config();

const initDatabase = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false // Run statements individually for better error handling
  });

  try {
    // Check if migrations have been run (migrations table exists and has entries)
    const [rows] = await connection.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'migrations'
    `, [process.env.DB_NAME]);
    
    if (rows[0].count > 0) {
      const [migrationCount] = await connection.query('SELECT COUNT(*) as count FROM migrations');
      if (migrationCount[0].count > 0) {
        console.log('✅ Database managed by migrations - skipping legacy init');
        return;
      }
    }

    // Legacy: Run initial migration schema if migrations haven't been set up yet
    console.log('⚠️  No migrations found - running legacy schema initialization');
    
    const fs = require('fs');
    const path = require('path');
    
    const schemaPath = path.join(__dirname, '..', 'migrations', '001_initial_schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Remove CREATE DATABASE and USE statements since we already connect to the correct DB
    schema = schema.replace(/CREATE DATABASE.*;/gi, '');
    schema = schema.replace(/USE .*;/gi, '');

    // Split into individual statements and run each
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await connection.query(statement);
      } catch (err) {
        // Ignore duplicate key/table/column errors (safe to skip)
        const ignorableErrors = [1050, 1060, 1061]; // table exists, column exists, index exists
        if (!ignorableErrors.includes(err.errno)) {
          console.warn(`⚠️  ${err.message.substring(0, 60)}`);
        }
      }
    }
    console.log('✅ Database schema initialized successfully');
    
  } catch (error) {
    // If database doesn't exist yet, migrations will handle it
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('✅ Database will be initialized by migrations');
      return;
    }
    console.error('❌ Error initializing schema:', error.message);
  } finally {
    await connection.end();
  }
};

module.exports = initDatabase;
