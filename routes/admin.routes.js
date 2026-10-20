// routes/admin.routes.js
'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/adminController');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf }  = require('../middleware/csrf');
const { validate }    = require('../middleware/validate');

// All admin API routes require authentication + CSRF check
router.use(requireAuth, verifyCsrf);

// GET  /api/admin/dashboard
router.get('/dashboard', controller.dashboard);

// Settings
router.get('/settings',  controller.getSettings);
router.put('/settings',  validate('settings'), controller.updateSettings);

// Categories
router.get('/categories',        controller.listCategories);
router.post('/categories',       validate('category'), controller.createCategory);
router.put('/categories/:id',    validate('category'), controller.updateCategory);
router.delete('/categories/:id', controller.deleteCategory);

// Certificates
router.get('/certificates',        controller.listCertificates);
router.post('/certificates',       validate('certificate'), controller.createCertificate);
router.put('/certificates/:id',    validate('certificate'), controller.updateCertificate);
router.delete('/certificates/:id', controller.deleteCertificate);

// Skills — categories (homepage cards) and the skills inside them
router.get('/skills',                     controller.listSkills);
router.post('/skill-categories',          validate('skillCategory'), controller.createSkillCategory);
router.put('/skill-categories/:id',       validate('skillCategory'), controller.updateSkillCategory);
router.delete('/skill-categories/:id',    controller.deleteSkillCategory);
router.post('/skills',                    validate('skill'), controller.createSkill);
router.put('/skills/:id',                 validate('skill'), controller.updateSkill);
router.delete('/skills/:id',              controller.deleteSkill);

// Education + experience — each list is saved as a whole
router.get('/education',   controller.listEducation);
router.put('/education',   validate('education'), controller.replaceEducation);
router.get('/experience',  controller.listExperience);
router.put('/experience',  validate('experience'), controller.replaceExperience);

// Technologies + tags (autocomplete in forms)
router.get('/technologies',  controller.listTechnologies);
router.get('/tags',          controller.listTags);

module.exports = router;
