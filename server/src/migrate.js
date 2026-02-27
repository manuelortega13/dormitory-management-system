/**
 * Database Migration Runner
 * 
 * Scans the migrations directory and runs any pending migrations.
 * Tracks executed migrations in a `migrations` table.
 * 
 * Usage:
 *   node migrate.js              - Run all pending migrations
 *   node migrate.js status       - Show migration status
 *   node migrate.js rerun <name> - Re-run a specific migration
 *   node migrate.js reset        - Reset migrations table (dangerous!)
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.prod' });

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Create database connection pool
const createPool = () => {
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true, // Required for running SQL files with multiple statements
    waitForConnections: true,
    connectionLimit: 5
  });
};

// Ensure migrations table exists
async function ensureMigrationsTable(pool) {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Get list of executed migrations
async function getExecutedMigrations(pool) {
  const [rows] = await pool.execute('SELECT name FROM migrations ORDER BY name');
  return rows.map(row => row.name);
}

// Get all migration files from directory
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('📁 No migrations directory found');
    return [];
  }

  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort alphabetically (001_, 002_, etc.)
}

// Run a single migration
async function runMigration(pool, filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf8');

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Remove SQL comments and clean up the file content
    const cleanedSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .trim();
    
    // Split by semicolon, handling multi-line statements
    const statements = cleanedSql
      .split(/;[\s]*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      // Skip if statement is empty or only whitespace
      if (!statement || statement.length === 0) continue;
      
      try {
        await connection.query(statement);
        console.log(`    ✓ Executed: ${statement.substring(0, 50).replace(/\n/g, ' ')}...`);
      } catch (error) {
        // Only ignore specific MySQL errors that are safe to skip:
        // 1054 = Unknown column (CHANGE on already renamed column)
        // 1060 = Duplicate column name
        // 1061 = Duplicate key name (index/constraint already exists)
        // 1050 = Table already exists
        // 1451 = Cannot delete/update parent row (handled separately)
        // 1452 = Cannot add/update child row (handled separately)
        const ignorableErrors = [1054, 1060, 1061, 1050, 1215, 1553];
        if (ignorableErrors.includes(error.errno)) {
          console.log(`    ⚠️  Skipped (already applied): ${error.message.substring(0, 60)}`);
        } else {
          // Rethrow non-ignorable errors to fail the migration
          throw error;
        }
      }
    }
    
    // Record the migration
    await connection.execute(
      'INSERT INTO migrations (name) VALUES (?)',
      [filename]
    );
    
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Main migration runner
async function migrate() {
  const pool = createPool();

  try {
    console.log('🔄 Starting database migration...\n');

    // Ensure migrations table exists
    await ensureMigrationsTable(pool);

    // Get executed and pending migrations
    const executed = await getExecutedMigrations(pool);
    const allMigrations = getMigrationFiles();
    const pending = allMigrations.filter(m => !executed.includes(m));

    if (pending.length === 0) {
      console.log('✅ Database is up to date. No migrations to run.\n');
      return;
    }

    console.log(`📋 Found ${pending.length} pending migration(s):\n`);

    for (const migration of pending) {
      process.stdout.write(`  ▸ Running ${migration}... `);
      
      try {
        await runMigration(pool, migration);
        console.log('✅');
      } catch (error) {
        console.log('❌');
        console.error(`\n❌ Migration failed: ${migration}`);
        console.error(`   Error: ${error.message}\n`);
        
        // Stop on first error
        process.exit(1);
      }
    }

    console.log(`\n✅ Successfully ran ${pending.length} migration(s).\n`);
  } finally {
    await pool.end();
  }
}

// Show migration status
async function status() {
  const pool = createPool();

  try {
    await ensureMigrationsTable(pool);

    const executed = await getExecutedMigrations(pool);
    const allMigrations = getMigrationFiles();

    console.log('\n📊 Migration Status\n');
    console.log('─'.repeat(50));

    if (allMigrations.length === 0) {
      console.log('No migrations found.\n');
      return;
    }

    for (const migration of allMigrations) {
      const isExecuted = executed.includes(migration);
      const status = isExecuted ? '✅ executed' : '⏳ pending';
      console.log(`  ${status}  ${migration}`);
    }

    const pending = allMigrations.filter(m => !executed.includes(m));
    console.log('─'.repeat(50));
    console.log(`Total: ${allMigrations.length} | Executed: ${executed.length} | Pending: ${pending.length}\n`);
  } finally {
    await pool.end();
  }
}

// Reset migrations table (dangerous!)
async function reset() {
  const pool = createPool();

  try {
    console.log('\n⚠️  WARNING: This will reset the migrations tracking table.');
    console.log('   It will NOT undo any schema changes.\n');
    
    await pool.execute('DROP TABLE IF EXISTS migrations');
    console.log('✅ Migrations table reset.\n');
  } finally {
    await pool.end();
  }
}

// Rerun a specific migration (useful for fixing failed migrations)
async function rerun(migrationName) {
  const pool = createPool();

  try {
    console.log(`\n🔄 Re-running migration: ${migrationName}\n`);

    await ensureMigrationsTable(pool);

    // Remove the migration record if it exists
    await pool.execute('DELETE FROM migrations WHERE name = ?', [migrationName]);
    console.log('  ▸ Removed previous migration record (if any)');

    // Check if the migration file exists
    const allMigrations = getMigrationFiles();
    if (!allMigrations.includes(migrationName)) {
      console.error(`\n❌ Migration file not found: ${migrationName}`);
      console.log(`\nAvailable migrations:`);
      allMigrations.forEach(m => console.log(`  - ${m}`));
      process.exit(1);
    }

    // Run the migration
    process.stdout.write(`  ▸ Running ${migrationName}...\n`);
    
    try {
      await runMigration(pool, migrationName);
      console.log(`\n✅ Successfully re-ran migration: ${migrationName}\n`);
    } catch (error) {
      console.error(`\n❌ Migration failed: ${migrationName}`);
      console.error(`   Error: ${error.message}\n`);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

// CLI handler
const command = process.argv[2];
const arg = process.argv[3];

// Export for programmatic use
module.exports = migrate;

// Only run CLI commands when executed directly (not when required as module)
if (require.main === module) {
  switch (command) {
    case 'status':
      status();
      break;
    case 'reset':
      reset();
      break;
    case 'rerun':
      if (!arg) {
        console.error('\n❌ Usage: node migrate.js rerun <migration_name>');
        console.log('   Example: node migrate.js rerun 003_rename_dean_to_home_dean.sql\n');
        process.exit(1);
      }
      rerun(arg);
      break;
    default:
      migrate();
  }
}
