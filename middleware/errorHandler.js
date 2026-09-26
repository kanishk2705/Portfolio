// middleware/errorHandler.js
'use strict';

const env = require('../config/env');

/**
 * Central Express error handler — must be registered LAST with app.use().
 * Catches anything passed to next(err) from routes or async wrappers.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status  = err.status || err.statusCode || 500;
  const isApi   = req.path.startsWith('/api/');

  // Log server errors (not 4xx — those are expected)
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.path} →`, err);
  }

  if (isApi) {
    return res.status(status).json({
      success: false,
      message: env.IS_PRODUCTION && status === 500
        ? 'An unexpected error occurred.'
        : (err.message || 'Unknown error'),
    });
  }

  // Non-API: render a minimal HTML error page
  res.status(status).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${status} – Portfolio</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; }
    .box { text-align: center; }
    h1 { font-size: 4rem; margin: 0; color: #111827; }
    p  { color: #6b7280; margin: 1rem 0 2rem; }
    a  { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="box">
    <h1>${status}</h1>
    <p>${status === 404 ? 'Page not found.' : 'Something went wrong.'}</p>
    <a href="/">← Back to home</a>
  </div>
</body>
</html>`);
}

/**
 * Wrap an async route handler so any rejected promise is forwarded
 * to next(err) automatically — avoids try/catch boilerplate everywhere.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create an error with a specific HTTP status attached.
 */
function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { errorHandler, asyncHandler, createError };
