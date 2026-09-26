// middleware/auth.js
'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { createError } = require('./errorHandler');

const COOKIE_NAME = 'auth_token';

/**
 * requireAuth — Express middleware that verifies the JWT stored in the
 * httpOnly "auth_token" cookie.  Attaches the decoded payload to req.user.
 *
 * On failure: API routes get a 401 JSON response; page routes redirect to login.
 */
function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return _reject(req, res, 'Authentication required.');
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;          // { id, email, name, role, iat, exp }
    return next();
  } catch (err) {
    // Clear an expired/invalid cookie so the browser doesn't keep sending it
    res.clearCookie(COOKIE_NAME, _cookieOpts());
    const message = err.name === 'TokenExpiredError'
      ? 'Session expired. Please log in again.'
      : 'Invalid session. Please log in again.';
    return _reject(req, res, message);
  }
}

/**
 * issueToken — signs a JWT and sets it as an httpOnly cookie.
 * Also sets a readable CSRF cookie (see middleware/csrf.js).
 */
function issueToken(res, user) {
  const payload = { id: user.id, email: user.email, name: user.name, role: user.role };

  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  // httpOnly: JS cannot read this — prevents XSS token theft
  res.cookie(COOKIE_NAME, token, {
    ..._cookieOpts(),
    httpOnly: true,
    maxAge: _msFromExpiry(env.JWT_EXPIRES_IN),
  });

  // Readable CSRF token: JS *can* read this to attach as a header
  const { crypto } = require('crypto') || globalThis.crypto || require('node:crypto');
  const csrfToken = require('crypto').randomBytes(24).toString('hex');
  res.cookie('csrf_token', csrfToken, {
    ..._cookieOpts(),
    httpOnly: false,     // must be readable by JS
    maxAge: _msFromExpiry(env.JWT_EXPIRES_IN),
  });

  return token;
}

/**
 * clearTokens — removes auth and CSRF cookies on logout.
 */
function clearTokens(res) {
  res.clearCookie(COOKIE_NAME, _cookieOpts());
  res.clearCookie('csrf_token', _cookieOpts());
}

// ── helpers ────────────────────────────────────────────────────

function _cookieOpts() {
  return {
    sameSite: 'strict',
    secure: env.IS_PRODUCTION,
    path: '/',
  };
}

function _reject(req, res, message) {
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, message });
  }
  return res.redirect(`/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
}

/** Convert a JWT expiry string like "7d", "2h", "30m" to milliseconds */
function _msFromExpiry(expiry) {
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match  = String(expiry).match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 86400000;
  return parseInt(match[1], 10) * units[match[2]];
}

module.exports = { requireAuth, issueToken, clearTokens };
