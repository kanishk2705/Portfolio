// routes/auth.routes.js
'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');

// POST /api/auth/login
router.post('/login', loginLimiter, controller.login);

// POST /api/auth/logout  (also handles GET for browser redirect)
router.get('/logout',  controller.logout);
router.post('/logout', controller.logout);

// GET /api/auth/me  (requires valid session)
router.get('/me', requireAuth, controller.me);

module.exports = router;
