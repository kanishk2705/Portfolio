// models/User.js
'use strict';

const { getDb } = require('../config/db');

const User = {
  findByEmail(email) {
    return getDb().prepare(
      'SELECT * FROM users WHERE email = ?'
    ).get(email);
  },

  findById(id) {
    return getDb().prepare(
      'SELECT id, email, name, role, last_login_at, created_at FROM users WHERE id = ?'
    ).get(id);
  },

  updateLastLogin(id) {
    return getDb().prepare(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(id);
  },
};

module.exports = User;
