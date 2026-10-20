// models/Setting.js
'use strict';

const { getDb } = require('../config/db');

const Setting = {
  /** Settings safe to expose to visitors, as { key: value } */
  publicAll() {
    const rows = getDb().prepare(`
      SELECT key, value FROM settings
      WHERE key NOT LIKE 'admin.%'
      ORDER BY key
    `).all();
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    return settings;
  },
};

module.exports = Setting;
