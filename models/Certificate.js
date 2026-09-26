// models/Certificate.js
'use strict';

const { getDb } = require('../config/db');

const Certificate = {
  listAll() {
    return getDb().prepare('SELECT * FROM certificates ORDER BY sort_order, issue_date DESC').all();
  },

  findById(id) {
    return getDb().prepare('SELECT * FROM certificates WHERE id = ?').get(id);
  },

  create({ title, issuer, issue_date = null, credential_url = null, image_path = null, sort_order = 0 }) {
    return getDb().prepare(`
      INSERT INTO certificates (title, issuer, issue_date, credential_url, image_path, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, issuer, issue_date, credential_url, image_path, sort_order);
  },

  update(id, { title, issuer, issue_date, credential_url, image_path, sort_order }) {
    return getDb().prepare(`
      UPDATE certificates
      SET title = ?, issuer = ?, issue_date = ?, credential_url = ?, image_path = ?, sort_order = ?
      WHERE id = ?
    `).run(title, issuer, issue_date, credential_url, image_path, sort_order, id);
  },

  delete(id) {
    return getDb().prepare('DELETE FROM certificates WHERE id = ?').run(id);
  },
};

module.exports = Certificate;
