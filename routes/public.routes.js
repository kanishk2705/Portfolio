// routes/public.routes.js
'use strict';

const path       = require('path');
const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/projectController');
const Setting    = require('../models/Setting');
const Skill      = require('../models/Skill');
const Certificate = require('../models/Certificate');
const Category   = require('../models/Category');
const Profile    = require('../models/Profile');

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
    res.json({ success: true, categories: Category.listWithCounts() });
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

// GET /api/education
router.get('/education', (req, res, next) => {
  try {
    res.json({ success: true, items: Profile.listEducation() });
  } catch (err) { next(err); }
});

// GET /api/experience
router.get('/experience', (req, res, next) => {
  try {
    res.json({ success: true, items: Profile.listExperience() });
  } catch (err) { next(err); }
});

// GET /api/settings/public — subset of settings safe to expose publicly
router.get('/settings/public', (req, res, next) => {
  try {
    res.json({ success: true, settings: Setting.publicAll() });
  } catch (err) { next(err); }
});

module.exports = router;
