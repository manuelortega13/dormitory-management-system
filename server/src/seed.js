/**
 * Database Seed Runner
 *
 * Executes src/config/seed.sql against the configured database to create default
 * users/rooms. The seed uses "ON DUPLICATE KEY UPDATE", so it is idempotent and
 * safe to run more than once.
 *
 * Connection can be provided either via the standard DB_* env vars, or via a full
 * connection URL in MYSQL_PUBLIC_URL / MYSQL_URL / DATABASE_URL / DB_URL
 * (handy for running against Railway's public proxy from your laptop).
 *
 * Usage:
 *   npm run seed
 *   MYSQL_PUBLIC_URL='mysql://root:pass@host.proxy.rlwy.net:12345/railway' npm run seed
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

const SEED_FILE = path.join(__dirname, 'config', 'seed.sql');

function getConnectionConfig() {
  const url =
    process.env.MYSQL_PUBLIC_URL ||
    process.env.MYSQL_URL ||
    process.env.DATABASE_URL ||
    process.env.DB_URL;
  if (url) return url; // mysql2 accepts a connection URI string

  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dormitory_db',
  };
}

async function seed() {
  if (!fs.existsSync(SEED_FILE)) {
    console.error(`❌ Seed file not found: ${SEED_FILE}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(SEED_FILE, 'utf8');

  // Strip comment lines, split into statements, and drop any "USE <db>" statements
  // (the connection already selects the target database).
  const statements = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^USE\b/i.test(s));

  const connection = await mysql.createConnection(getConnectionConfig());
  console.log(`🌱 Running ${statements.length} seed statement(s)...\n`);

  try {
    let executed = 0;
    for (const statement of statements) {
      await connection.query(statement);
      executed++;
      console.log(`  ✓ ${statement.replace(/\s+/g, ' ').substring(0, 60)}...`);
    }
    console.log(`\n✅ Seed complete (${executed} statement(s) executed).`);
  } finally {
    await connection.end();
  }
}

seed().catch((error) => {
  console.error('\n❌ Seed failed:', error.message);
  process.exit(1);
});
