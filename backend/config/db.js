const mysql  = require('mysql2');
const fs     = require('fs');
const path   = require('path');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
  host:             process.env.DB_HOST,
  port:             process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user:             process.env.DB_USER,
  password:         process.env.DB_PASSWORD,
  database:         process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:  4,
  queueLimit:       0,
  multipleStatements: true,
});

const promisePool = pool.promise();

async function runMigrations() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql        = fs.readFileSync(schemaPath, 'utf8');

  // Strip the CREATE DATABASE and USE statements — the db is already selected via pool config
  const filtered = sql
    .replace(/CREATE DATABASE[\s\S]*?;/gi, '')
    .replace(/USE\s+\S+\s*;/gi, '');

  try {
    await promisePool.query(filtered);
    console.log('Database schema applied successfully');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

pool.getConnection(async (err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('MySQL connected successfully');
  connection.release();
  await runMigrations();
});

module.exports = promisePool;
