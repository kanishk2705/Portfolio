// config/db.js
// ---------------------------------------------------------------
// Opens a single better-sqlite3 connection and re-uses it for
// the lifetime of the process. All models import this module.
// ---------------------------------------------------------------
'use strict';

const path     = require('path');
const fs       = require('fs');
const Database = require('better-sqlite3');
const env      = require('./env');

let _db = null;

function getDb() {
  if (_db) return _db;

  const dbPath = path.resolve(env.DATABASE_PATH);

  // Make sure the directory exists (important on Render's mounted disk)
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  _db = new Database(dbPath);

  // Connection-level pragmas — must run every time a connection is opened
  _db.pragma('journal_mode = WAL');   // allows concurrent reads during writes
  _db.pragma('foreign_keys = ON');    // enforce FK constraints
  _db.pragma('busy_timeout = 5000');  // wait up to 5 s before SQLITE_BUSY
  _db.pragma('synchronous = NORMAL'); // safe + fast in WAL mode

  if (env.IS_DEVELOPMENT) {
    console.log(`[db] Connected → ${dbPath}`);
  }

  return _db;
}

module.exports = { getDb };
