// models/Category.js
'use strict';

const { getDb } = require('../config/db');

const Category = {
  listAll() {
    return getDb().prepare(
      'SELECT * FROM categories ORDER BY sort_order, name'
    ).all();
  },

  /** Categories with how many published projects each has (public API) */
  listWithCounts() {
    return getDb().prepare(`
      SELECT c.*, COUNT(p.id) AS project_count
      FROM categories c
      LEFT JOIN projects p ON p.category_id = c.id AND p.status = 'published'
      GROUP BY c.id
      ORDER BY c.sort_order, c.name
    `).all();
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
