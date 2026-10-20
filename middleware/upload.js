// middleware/upload.js
'use strict';

const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const env    = require('../config/env');
const { uniqueFilename } = require('../utils/fileNaming');

const UPLOAD_ROOT = path.resolve(env.UPLOADS_PATH);

// Allowed MIME types per upload category
const ALLOWED = {
  image: new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  ]),
  video: new Set([
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  ]),
  document: new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
};

function makeStorage(subfolder) {
  const dest = path.join(UPLOAD_ROOT, subfolder);
  // Ensure the directory exists at startup
  fs.mkdirSync(dest, { recursive: true });

  return multer.diskStorage({
    destination(_req, _file, cb) { cb(null, dest); },
    filename(_req, file, cb)     { cb(null, uniqueFilename(file.originalname)); },
  });
}

function fileFilter(category) {
  return function (_req, file, cb) {
    if (ALLOWED[category].has(file.mimetype)) {
      cb(null, true);
    } else {
      const allowed = [...ALLOWED[category]].join(', ');
      cb(Object.assign(new Error(`Invalid file type "${file.mimetype}". Allowed: ${allowed}`), { status: 400 }));
    }
  };
}

// ── Named multer instances ─────────────────────────────────────

const uploadImage = multer({
  storage:    makeStorage('images'),
  fileFilter: fileFilter('image'),
  limits: { fileSize: env.MAX_IMAGE_SIZE_MB * 1024 * 1024 },
});

const uploadVideo = multer({
  storage:    makeStorage('videos'),
  fileFilter: fileFilter('video'),
  limits: { fileSize: env.MAX_VIDEO_SIZE_MB * 1024 * 1024 },
});

const uploadDocument = multer({
  storage:    makeStorage('documents'),
  fileFilter: fileFilter('document'),
  limits: { fileSize: env.MAX_DOCUMENT_SIZE_MB * 1024 * 1024 },
});

// Multer error → standardised JSON response
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: `File too large. Maximum size: ${env.MAX_IMAGE_SIZE_MB} MB for images, ${env.MAX_VIDEO_SIZE_MB} MB for videos, ${env.MAX_DOCUMENT_SIZE_MB} MB for documents.`,
      LIMIT_FILE_COUNT: 'Too many files in one upload.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field name.',
    };
    return res.status(400).json({
      success: false,
      message: messages[err.code] || `Upload error: ${err.message}`,
    });
  }
  if (err?.status === 400) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
}

module.exports = { uploadImage, uploadVideo, uploadDocument, handleMulterError };
