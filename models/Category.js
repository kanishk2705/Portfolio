// models/Category.js
'use strict';

const { getDb } = require('../config/db');

const Category = {
  listAll() {
    return getDb().prepare(
      'SELECT * FROM categories ORDER BY sort_order, name'
    ).all();
  },

  findById(id) {
    return getDb().prepare('SELECT * FROM categories WHERE id = ?').get(id);
  },

  findBySlug(slug) {
    return getDb().prepare('SELECT * FROM categories WHERE slug = ?').get(slug);
  },

  create({ name, slug, description = null, sort_order = 0 }) {
    return getDb().prepare(`
      INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)
    `).run(name, slug, description, sort_order);
  },

  update(id, { name, slug, description, sort_order }) {
    return getDb().prepare(`
      UPDATE categories SET name = ?, slug = ?, description = ?, sort_order = ? WHERE id = ?
    `).run(name, slug, description, sort_order, id);
  },

  delete(id) {
    return getDb().prepare('DELETE FROM categories WHERE id = ?').run(id);
  },
};

module.exports = Category;
