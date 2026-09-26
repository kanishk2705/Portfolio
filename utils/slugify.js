// utils/slugify.js
'use strict';

/**
 * Convert a string to a URL-safe slug.
 *   "Customer Churn Prediction (2025)" → "customer-churn-prediction-2025"
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')                     // decompose accented chars
    .replace(/[\u0300-\u036f]/g, '')      // strip accent marks
    .replace(/[^a-z0-9\s-]/g, '')        // remove anything that isn't alphanumeric/space/dash
    .replace(/\s+/g, '-')                 // spaces → dashes
    .replace(/-+/g, '-')                  // collapse multiple dashes
    .replace(/^-|-$/g, '');              // trim leading/trailing dashes
}

/**
 * Generate a slug that doesn't already exist in the projects table.
 * Appends -2, -3, … until it finds a free slot.
 *
 * @param {string} title
 * @param {import('better-sqlite3').Database} db
 * @param {number|null} excludeId - when editing an existing project, pass its id
 *                                  so we don't collide with itself
 */
function uniqueProjectSlug(title, db, excludeId = null) {
  const base = slugify(title);
  let candidate = base;
  let counter = 2;

  const stmt = db.prepare(
    'SELECT id FROM projects WHERE slug = ? AND (? IS NULL OR id != ?)'
  );

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const row = stmt.get(candidate, excludeId, excludeId);
    if (!row) return candidate;      // free slot found
    candidate = `${base}-${counter}`;
    counter++;
  }
}

module.exports = { slugify, uniqueProjectSlug };
