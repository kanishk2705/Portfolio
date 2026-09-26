// models/Skill.js
'use strict';

const { getDb } = require('../config/db');

const Skill = {
  // ── Skill categories + their skills ───────────────────────

  listAllCategories() {
    const db = getDb();
    const cats = db.prepare(
      'SELECT * FROM skill_categories ORDER BY sort_order, name'
    ).all();

    for (const cat of cats) {
      cat.skills = db.prepare(
        'SELECT * FROM skills WHERE skill_category_id = ? ORDER BY sort_order, name'
      ).all(cat.id);
    }

    return cats;
  },

  // ── Technologies (reusable tech-stack chips) ──────────────

  listTechnologies() {
    return getDb().prepare('SELECT * FROM technologies ORDER BY name').all();
  },

  findOrCreateTechnology(name) {
    const db = getDb();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = db.prepare('SELECT * FROM technologies WHERE name = ?').get(name);
    if (existing) return existing;
    const result = db.prepare(
      'INSERT INTO technologies (name, slug) VALUES (?, ?)'
    ).run(name, slug);
    return { id: result.lastInsertRowid, name, slug };
  },

  // ── Tags ──────────────────────────────────────────────────

  listTags() {
    return getDb().prepare('SELECT * FROM tags ORDER BY name').all();
  },

  findOrCreateTag(name) {
    const db = getDb();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
    if (existing) return existing;
    const result = db.prepare(
      'INSERT INTO tags (name, slug) VALUES (?, ?)'
    ).run(name, slug);
    return { id: result.lastInsertRowid, name, slug };
  },
};

module.exports = Skill;
