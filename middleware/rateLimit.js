// middleware/rateLimit.js
'use strict';

const rateLimit = require('express-rate-limit');

const windowMs = 15 * 60 * 1000; // 15 minutes

/** Applied to the admin login endpoint only */
const loginLimiter = rateLimit({
  windowMs,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/** Applied to all /api/* routes */
const apiLimiter = rateLimit({
  windowMs,
  max: 300,
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Applied to upload endpoints (more generous window, lower cap) */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: { success: false, message: 'Upload limit reached. Please wait before uploading more files.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, apiLimiter, uploadLimiter };
