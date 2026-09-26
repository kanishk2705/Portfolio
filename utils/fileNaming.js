// utils/fileNaming.js
'use strict';

const path   = require('path');
const crypto = require('crypto');

/**
 * Sanitise the original filename's stem (not extension) so it's safe to use
 * on any filesystem and in URLs.
 */
function sanitiseStem(original) {
  return path
    .basename(original, path.extname(original))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)          // cap length
    || 'file';
}

/**
 * Build a unique upload filename.
 *
 *  "My Diagram.png"  →  "my-diagram-a3f9c2b1.png"
 *
 * The 8-char hex suffix comes from crypto.randomBytes so collisions are
 * astronomically unlikely even at high upload volume.
 */
function uniqueFilename(originalname) {
  const ext    = path.extname(originalname).toLowerCase();
  const stem   = sanitiseStem(originalname);
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${stem}-${suffix}${ext}`;
}

/**
 * Resolve the public URL path for an uploaded file given its storage path.
 * Strips the leading "uploads/" and normalises separators so it's safe
 * to store in the DB and serve back to the client.
 *
 *  "/home/claude/.../uploads/images/foo.png"  →  "/uploads/images/foo.png"
 */
function publicPath(absolutePath) {
  const uploadsIndex = absolutePath.replace(/\\/g, '/').lastIndexOf('/uploads/');
  if (uploadsIndex === -1) return absolutePath;
  return absolutePath.slice(uploadsIndex);
}

module.exports = { uniqueFilename, publicPath };
