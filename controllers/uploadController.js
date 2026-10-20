// controllers/uploadController.js
'use strict';

const Project = require('../models/Project');
const { getDb } = require('../config/db');
const { publicPath } = require('../utils/fileNaming');

const uploadController = {
  // POST /api/admin/upload/image
  // Field: "file" (single image)
  // Optional body: projectId, altText, caption, type ("thumbnail"|"banner"|"architecture"|"workflow"|"gallery")
  uploadImage(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file received.' });

      const filePath = publicPath(req.file.path);
      const { projectId, altText, caption, type } = req.body;

      // If linked to a project, decide what to do with it
      if (projectId) {
        const id = parseInt(projectId, 10);
        const column = {
          thumbnail:    'thumbnail_path',
          banner:       'banner_path',
          architecture: 'architecture_diagram_path',
          workflow:     'workflow_diagram_path',
        }[type];
        if (column) {
          getDb().prepare(`UPDATE projects SET ${column} = ? WHERE id = ?`).run(filePath, id);
        } else {
          // gallery image
          Project.addImage(id, filePath, altText || '', caption || '');
        }
      }

      res.json({
        success:  true,
        message:  'Image uploaded.',
        filePath,
        url:      filePath,
        filename: req.file.filename,
      });
    } catch (err) { next(err); }
  },

  // POST /api/admin/upload/video
  uploadVideo(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file received.' });

      const filePath  = publicPath(req.file.path);
      const { projectId, title } = req.body;

      if (projectId) {
        Project.addVideo(parseInt(projectId, 10), {
          source_type: 'upload',
          file_path:   filePath,
          external_url: null,
          title:       title || req.file.originalname,
        });
      }

      res.json({ success: true, message: 'Video uploaded.', filePath, url: filePath });
    } catch (err) { next(err); }
  },

  // POST /api/admin/upload/document
  uploadDocument(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file received.' });

      const filePath = publicPath(req.file.path);
      const { projectId, label } = req.body;

      if (projectId) {
        Project.addDocument(parseInt(projectId, 10), filePath, label || 'Report');
      }

      res.json({ success: true, message: 'Document uploaded.', filePath, url: filePath });
    } catch (err) { next(err); }
  },

  // POST /api/admin/upload/external-video
  // Links a YouTube/Vimeo URL to a project without file upload
  addExternalVideo(req, res, next) {
    try {
      const { projectId, url, title } = req.body;
      if (!projectId || !url) {
        return res.status(400).json({ success: false, message: 'projectId and url are required.' });
      }
      Project.addVideo(parseInt(projectId, 10), {
        source_type:  'external',
        file_path:    null,
        external_url: url,
        title:        title || url,
      });
      res.json({ success: true, message: 'External video linked.' });
    } catch (err) { next(err); }
  },
};

module.exports = uploadController;
