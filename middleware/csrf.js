// middleware/csrf.js
// ---------------------------------------------------------------
// Double-submit cookie pattern:
//   1. On login, a random token is set in a readable cookie "csrf_token".
//   2. The admin JS reads that cookie and attaches it as the
//      "X-CSRF-Token" request header on every POST/PUT/DELETE.
//   3. This middleware compares header === cookie.
//
// This defeats CSRF because a cross-origin attacker's form cannot
// read the cookie value (same-origin policy) and therefore cannot
// set the matching header.
// ---------------------------------------------------------------
'use strict';

const EXEMPT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function verifyCsrf(req, res, next) {
  // Only state-changing requests need CSRF protection
  if (EXEMPT_METHODS.has(req.method)) return next();

  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = req.cookies?.['csrf_token'];

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token mismatch. Please refresh and try again.',
    });
  }

  next();
}

module.exports = { verifyCsrf };
