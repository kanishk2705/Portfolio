// models/Skill.js
'use strict';

const crypto = require('crypto');
const { getDb } = require('../config/db');

/** "Distribution Shift" → "distribution-shift", "C++" → "cplusplus", "C#" → "csharp" */
function labelSlug(name) {
  const slug = name.toLowerCase()
    .replace(/\+/g, 'plus').replace(/#/g, 'sharp')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // Names with no latin letters/digits still need a unique, stable slug
  return slug || `label-${crypto.createHash('sha1').update(name).digest('hex').slice(0, 8)}`;
}

/**
 * Find a tag/technology by slug, so "model evaluation" and "Model Evaluation"
 * are the same label, or create it. The display name follows the latest
 * spelling you typed (it is shared by every project using the label).
 */
function findOrCreateLabel(table, rawName) {
  const db = getDb();
  const name = rawName.trim();
  const slug = labelSlug(name);
  const existing = db.prepare(`SELECT * FROM ${table} WHERE slug = ?`).get(slug);
  if (existing) {
    if (existing.name !== name) {
      db.prepare(`UPDATE ${table} SET name = ? WHERE id = ?`).run(name, existing.id);
      existing.name = name;
    }
    return existing;
  }
  const result = db.prepare(`INSERT INTO ${table} (name, slug) VALUES (?, ?)`).run(name, slug);
  return { id: result.lastInsertRowid, name, slug };
}

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

  createCategory({ name, icon, sort_order }) {
    return getDb().prepare(
      'INSERT INTO skill_categories (name, icon, sort_order) VALUES (?, ?, ?)'
    ).run(name.trim(), icon || null, sort_order || 0).lastInsertRowid;
  },

  updateCategory(id, { name, icon, sort_order }) {
    return getDb().prepare(
      'UPDATE skill_categories SET name = ?, icon = ?, sort_order = ? WHERE id = ?'
    ).run(name.trim(), icon || null, sort_order || 0, id);
  },

  /** Deleting a category also deletes its skills (ON DELETE CASCADE) */
  deleteCategory(id) {
    return getDb().prepare('DELETE FROM skill_categories WHERE id = ?').run(id);
  },

  createSkill({ skill_category_id, name, proficiency, sort_order }) {
    return getDb().prepare(`
      INSERT INTO skills (skill_category_id, name, proficiency, sort_order) VALUES (?, ?, ?, ?)
    `).run(skill_category_id, name.trim(), proficiency || null, sort_order || 0).lastInsertRowid;
  },

  updateSkill(id, { skill_category_id, name, proficiency, sort_order }) {
    return getDb().prepare(`
      UPDATE skills SET skill_category_id = ?, name = ?, proficiency = ?, sort_order = ? WHERE id = ?
    `).run(skill_category_id, name.trim(), proficiency || null, sort_order || 0, id);
  },

  deleteSkill(id) {
    return getDb().prepare('DELETE FROM skills WHERE id = ?').run(id);
  },

  // ── Technologies (reusable tech-stack chips) ──────────────

  listTechnologies() {
    return getDb().prepare('SELECT * FROM technologies ORDER BY name').all();
  },

  findOrCreateTechnology(name) {
    return findOrCreateLabel('technologies', name);
  },

  // ── Tags ──────────────────────────────────────────────────

  listTags() {
    return getDb().prepare('SELECT * FROM tags ORDER BY name').all();
  },

  findOrCreateTag(name) {
    return findOrCreateLabel('tags', name);
  },
};

module.exports = Skill;
