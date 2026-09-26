// controllers/adminController.js
'use strict';

const Project     = require('../models/Project');
const Category    = require('../models/Category');
const Certificate = require('../models/Certificate');
const Skill       = require('../models/Skill');
const { getDb }  = require('../config/db');

const adminController = {
  // GET /api/admin/dashboard
  dashboard(req, res, next) {
    try {
      const db    = getDb();
      const stats = Project.stats();

      const categoryBreakdown = db.prepare(`
        SELECT c.name, COUNT(p.id) AS count
        FROM categories c
        LEFT JOIN projects p ON p.category_id = c.id AND p.status = 'published'
        GROUP BY c.id ORDER BY c.sort_order
      `).all();

      res.json({
        success: true,
        dashboard: {
          projects:   stats,
          categories: categoryBreakdown,
        },
      });
    } catch (err) { next(err); }
  },

  // ── Settings ───────────────────────────────────────────────

  // GET /api/admin/settings
  getSettings(req, res, next) {
    try {
      const rows = getDb().prepare('SELECT key, value FROM settings ORDER BY key').all();
      const settings = {};
      for (const row of rows) settings[row.key] = row.value;
      res.json({ success: true, settings });
    } catch (err) { next(err); }
  },

  // PUT /api/admin/settings
  updateSettings(req, res, next) {
    try {
      const db      = getDb();
      const updates = req.body;  // { "contact.email": "...", "hero.headline": "..." }

      if (typeof updates !== 'object' || Array.isArray(updates)) {
        return res.status(400).json({ success: false, message: 'Body must be a key/value object.' });
      }

      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      const tx   = db.transaction((pairs) => {
        for (const [key, value] of pairs) stmt.run(key, value);
      });
      tx(Object.entries(updates));

      res.json({ success: true, message: 'Settings saved.' });
    } catch (err) { next(err); }
  },

  // ── Categories ─────────────────────────────────────────────

  listCategories(req, res, next) {
    try {
      res.json({ success: true, categories: Category.listAll() });
    } catch (err) { next(err); }
  },

  createCategory(req, res, next) {
    try {
      const { name, slug, description, sort_order } = req.body;
      if (!name || !slug) return res.status(400).json({ success: false, message: 'name and slug are required.' });
      Category.create({ name, slug, description, sort_order });
      res.status(201).json({ success: true, categories: Category.listAll() });
    } catch (err) { next(err); }
  },

  updateCategory(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { name, slug, description, sort_order } = req.body;
      if (!name || !slug) return res.status(400).json({ success: false, message: 'name and slug are required.' });
      Category.update(id, { name, slug, description, sort_order });
      res.json({ success: true, categories: Category.listAll() });
    } catch (err) { next(err); }
  },

  deleteCategory(req, res, next) {
    try {
      Category.delete(parseInt(req.params.id, 10));
      res.json({ success: true, categories: Category.listAll() });
    } catch (err) { next(err); }
  },

  // ── Certificates ───────────────────────────────────────────

  listCertificates(req, res, next) {
    try {
      res.json({ success: true, certificates: Certificate.listAll() });
    } catch (err) { next(err); }
  },

  createCertificate(req, res, next) {
    try {
      const { title, issuer, issue_date, credential_url, sort_order } = req.body;
      if (!title || !issuer) return res.status(400).json({ success: false, message: 'title and issuer are required.' });
      Certificate.create({ title, issuer, issue_date, credential_url, sort_order });
      res.status(201).json({ success: true, certificates: Certificate.listAll() });
    } catch (err) { next(err); }
  },

  updateCertificate(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { title, issuer, issue_date, credential_url, image_path, sort_order } = req.body;
      Certificate.update(id, { title, issuer, issue_date, credential_url, image_path, sort_order });
      res.json({ success: true, certificates: Certificate.listAll() });
    } catch (err) { next(err); }
  },

  deleteCertificate(req, res, next) {
    try {
      Certificate.delete(parseInt(req.params.id, 10));
      res.json({ success: true, certificates: Certificate.listAll() });
    } catch (err) { next(err); }
  },

  // ── Skills (read-only from admin for now) ─────────────────

  listSkills(req, res, next) {
    try {
      res.json({ success: true, skillCategories: Skill.listAllCategories() });
    } catch (err) { next(err); }
  },

  // ── Technologies + Tags ────────────────────────────────────

  listTechnologies(req, res, next) {
    try {
      res.json({ success: true, technologies: Skill.listTechnologies() });
    } catch (err) { next(err); }
  },

  listTags(req, res, next) {
    try {
      res.json({ success: true, tags: Skill.listTags() });
    } catch (err) { next(err); }
  },
};

module.exports = adminController;
