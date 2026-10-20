// utils/uploads.js
// ---------------------------------------------------------------
// Helpers for files stored under UPLOADS_PATH and referenced in the
// database by their public path ("/uploads/images/foo.png").
// ---------------------------------------------------------------
'use strict';

const path = require('path');
const fs   = require('fs');
const env  = require('../config/env');
const { getDb } = require('../config/db');

const UPLOAD_ROOT = path.resolve(env.UPLOADS_PATH);

/**
 * Map a public "/uploads/..." path to its absolute location on disk.
 * Returns null for anything outside the uploads folder (external URLs,
 * static assets, path-traversal attempts).
 */
function resolveUploadPath(publicPath) {
  if (typeof publicPath !== 'string' || !publicPath.startsWith('/uploads/')) return null;
  const full = path.resolve(UPLOAD_ROOT, publicPath.slice('/uploads/'.length));
  return full.startsWith(UPLOAD_ROOT + path.sep) ? full : null;
}

/** True if any table still points at this public path. */
function isReferenced(publicPath) {
  const db = getDb();
  const checks = [
    `SELECT 1 FROM projects WHERE ? IN (thumbnail_path, banner_path, architecture_diagram_path, workflow_diagram_path)`,
    'SELECT 1 FROM project_images WHERE file_path = ?',
    'SELECT 1 FROM project_videos WHERE file_path = ?',
    'SELECT 1 FROM project_documents WHERE file_path = ?',
    'SELECT 1 FROM certificates WHERE image_path = ?',
    'SELECT 1 FROM settings WHERE value = ?',
  ];
  return checks.some((sql) => db.prepare(sql).get(publicPath));
}

/**
 * Delete uploaded files that nothing in the database references any more.
 * Call after a write that may have dropped references. Never throws —
 * a leftover file is better than a failed save.
 */
function removeUnreferenced(publicPaths) {
  for (const p of new Set(publicPaths.filter(Boolean))) {
    try {
      const full = resolveUploadPath(p);
      if (full && !isReferenced(p) && fs.existsSync(full)) fs.unlinkSync(full);
    } catch (err) {
      console.error(`[uploads] could not remove ${p}:`, err.message);
    }
  }
}

module.exports = { UPLOAD_ROOT, resolveUploadPath, removeUnreferenced };
