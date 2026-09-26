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

// Skills (read for autocomplete in forms)
router.get('/skills',        controller.listSkills);
router.get('/technologies',  controller.listTechnologies);
router.get('/tags',          controller.listTags);

module.exports = router;
