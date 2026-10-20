// database/migrate.js
// ---------------------------------------------------------------
// Brings any existing database up to date with schema.sql.
//
//  1. Re-applies schema.sql — every statement is IF NOT EXISTS, so this
//     only creates tables/indexes/triggers that are missing.
//  2. Adds columns that were introduced after a table was first created
//     (CREATE TABLE IF NOT EXISTS never alters an existing table).
//
// Runs automatically whenever the app opens the database, and from
// `npm run build:db`. Safe to run any number of times.
// ---------------------------------------------------------------
'use strict';

const fs   = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// [table, column, definition] — keep in sync with the CREATE TABLEs in schema.sql
const ADDED_COLUMNS = [
  ['projects', 'project_status', "TEXT NOT NULL DEFAULT 'completed' CHECK (project_status IN ('completed', 'ongoing', 'planned'))"],
  ['projects', 'started_on',     'TEXT'],
  ['projects', 'completed_on',   'TEXT'],
  ['projects', 'my_role',        'TEXT'],
  ['projects', 'key_learnings',  'TEXT'],
];

function migrate(db) {
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

  for (const [table, column, definition] of ADDED_COLUMNS) {
    const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
    if (!exists) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`[migrate] added ${table}.${column}`);
    }
  }
}

module.exports = { migrate };
