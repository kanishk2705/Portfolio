// models/Profile.js
// ---------------------------------------------------------------
// Education and experience entries. The admin edits each list as a
// whole (add / reorder / remove rows, then save), so writes replace
// the full list and sort_order follows the order received.
// ---------------------------------------------------------------
'use strict';

const { getDb } = require('../config/db');

const EDUCATION_FIELDS  = ['institution', 'degree', 'location', 'start_label', 'end_label', 'grade', 'highlights'];
const EXPERIENCE_FIELDS = ['role', 'organization', 'organization_url', 'location', 'employment_type',
                           'start_label', 'end_label', 'highlights'];

function replaceAll(table, fields, rows) {
  const db = getDb();
  const ins = db.prepare(`
    INSERT INTO ${table} (${fields.join(', ')}, sort_order)
    VALUES (${fields.map(() => '?').join(', ')}, ?)
  `);
  db.transaction(() => {
    db.prepare(`DELETE FROM ${table}`).run();
    rows.forEach((row, i) => ins.run(...fields.map((f) => (row[f] ?? '').toString().trim() || null), i));
  })();
}

const Profile = {
  listEducation() {
    return getDb().prepare('SELECT * FROM education ORDER BY sort_order, id').all();
  },

  replaceEducation(rows) {
    replaceAll('education', EDUCATION_FIELDS, rows);
  },

  listExperience() {
    return getDb().prepare('SELECT * FROM experience ORDER BY sort_order, id').all();
  },

  replaceExperience(rows) {
    replaceAll('experience', EXPERIENCE_FIELDS, rows);
  },
};

module.exports = Profile;
