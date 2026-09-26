// routes/upload.routes.js
'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/uploadController');
const { requireAuth }    = require('../middleware/auth');
const { verifyCsrf }     = require('../middleware/csrf');
const { uploadImage, uploadVideo, uploadDocument, handleMulterError } = require('../middleware/upload');
const { uploadLimiter }  = require('../middleware/rateLimit');

// All upload routes are protected
router.use(requireAuth, verifyCsrf, uploadLimiter);

// POST /api/admin/upload/image     field: "file"
router.post(
  '/image',
  (req, res, next) => uploadImage.single('file')(req, res, next),
  handleMulterError,
  controller.uploadImage
);

// POST /api/admin/upload/video     field: "file"
router.post(
  '/video',
  (req, res, next) => uploadVideo.single('file')(req, res, next),
  handleMulterError,
  controller.uploadVideo
);

// POST /api/admin/upload/document  field: "file"
router.post(
  '/document',
  (req, res, next) => uploadDocument.single('file')(req, res, next),
  handleMulterError,
  controller.uploadDocument
);

// POST /api/admin/upload/external-video  (no file, just a URL)
router.post('/external-video', controller.addExternalVideo);

module.exports = router;
