// database/init.js
// ---------------------------------------------------------------
// Reads schema.sql and applies it to the SQLite database.
// Called by: npm run build:db
// Safe to re-run — every CREATE TABLE uses IF NOT EXISTS.
// ---------------------------------------------------------------
'use strict';

const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');
const { migrate } = require('./migrate');
require('dotenv').config();

const DB_PATH     = process.env.DATABASE_PATH || path.join(__dirname, 'portfolio.db');

function initDatabase() {
  // Ensure the directory for the DB file exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log(`[init] Opening database at: ${DB_PATH}`);
  const db = new Database(DB_PATH, { verbose: null });

  // SQLite performance + correctness pragmas
  db.pragma('journal_mode = WAL');       // concurrent reads while writing
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  console.log('[init] Applying schema...');
  migrate(db);

  console.log('[init] Schema applied successfully.');
  db.close();
}

try {
  initDatabase();
  process.exit(0);
} catch (err) {
  console.error('[init] FAILED:', err.message);
  process.exit(1);
}
