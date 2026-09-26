// routes/public.routes.js
'use strict';

const path       = require('path');
const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/projectController');
const { getDb }  = require('../config/db');
const Skill      = require('../models/Skill');
const Certificate = require('../models/Certificate');
const Category   = require('../models/Category');

// ── Public API ─────────────────────────────────────────────────

// GET /api/projects
router.get('/projects', controller.listPublished);

// GET /api/projects/featured  (must come BEFORE /projects/:slug)
router.get('/projects/featured', controller.listFeatured);

// GET /api/projects/:slug
router.get('/projects/:slug', controller.getBySlug);

// GET /api/categories
router.get('/categories', (req, res, next) => {
  try {
    res.json({ success: true, categories: Category.listAll() });
  } catch (err) { next(err); }
});

// GET /api/skills
router.get('/skills', (req, res, next) => {
  try {
    res.json({ success: true, skillCategories: Skill.listAllCategories() });
  } catch (err) { next(err); }
});

// GET /api/certificates
router.get('/certificates', (req, res, next) => {
  try {
    res.json({ success: true, certificates: Certificate.listAll() });
  } catch (err) { next(err); }
});

// GET /api/settings/public — subset of settings safe to expose publicly
router.get('/settings/public', (req, res, next) => {
  try {
    const rows = getDb().prepare(`
      SELECT key, value FROM settings
      WHERE key NOT LIKE 'admin.%'
      ORDER BY key
    `).all();
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json({ success: true, settings });
  } catch (err) { next(err); }
});

module.exports = router;
