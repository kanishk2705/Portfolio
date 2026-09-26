// config/env.js
// ---------------------------------------------------------------
// Loads .env (in development) and validates all required vars.
// Import this module FIRST before anything else touches process.env.
// ---------------------------------------------------------------
'use strict';

require('dotenv').config();

function required(key) {
  const value = process.env[key];
  if (!value) {
    console.error(`[env] FATAL: environment variable "${key}" is not set.`);
    console.error(`[env] Copy .env.example to .env and fill in all values, then run again.`);
    process.exit(1);
  }
  return value;
}

function optional(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

const env = {
  NODE_ENV:       optional('NODE_ENV', 'development'),
  PORT:           parseInt(optional('PORT', '3000'), 10),
  SITE_URL:       optional('SITE_URL', 'http://localhost:3000'),

  DATABASE_PATH:  optional('DATABASE_PATH', './database/portfolio.db'),

  JWT_SECRET:     required('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),
  CSRF_SECRET:    required('CSRF_SECRET'),

  ADMIN_EMAIL:    optional('ADMIN_EMAIL'),
  ADMIN_PASSWORD: optional('ADMIN_PASSWORD'),

  MAX_IMAGE_SIZE_MB:    parseInt(optional('MAX_IMAGE_SIZE_MB',    '8'),   10),
  MAX_VIDEO_SIZE_MB:    parseInt(optional('MAX_VIDEO_SIZE_MB',    '200'), 10),
  MAX_DOCUMENT_SIZE_MB: parseInt(optional('MAX_DOCUMENT_SIZE_MB', '20'),  10),

  get IS_PRODUCTION() { return this.NODE_ENV === 'production'; },
  get IS_DEVELOPMENT() { return this.NODE_ENV === 'development'; },
};

module.exports = env;
