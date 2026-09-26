// controllers/projectController.js
'use strict';

const path    = require('path');
const fs      = require('fs');
const Project = require('../models/Project');
const Skill   = require('../models/Skill');
const { getDb } = require('../config/db');
const { uniqueProjectSlug } = require('../utils/slugify');
const { sanitizeHtml }      = require('../utils/sanitize');
const { publicPath }        = require('../utils/fileNaming');

// ── Public controllers ─────────────────────────────────────────

const projectController = {
  // GET /api/projects
  listPublished(req, res, next) {
    try {
      const { category, search, page, limit } = req.query;
      const result = Project.listPublished({
        categorySlug: category,
        search:       search?.trim(),
        page:         parseInt(page, 10) || 1,
        limit:        Math.min(parseInt(limit, 10) || 12, 50),
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  // GET /api/projects/featured
  listFeatured(req, res, next) {
    try {
      const projects = Project.listFeatured(parseInt(req.query.limit, 10) || 6);
      res.json({ success: true, projects });
    } catch (err) { next(err); }
  },

  // GET /api/projects/:slug  (public — published only)
  getBySlug(req, res, next) {
    try {
      const project = Project.findBySlug(req.params.slug);
      if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
      res.json({ success: true, project });
    } catch (err) { next(err); }
  },

  // ── Admin controllers ────────────────────────────────────────

  // GET /api/admin/projects
  listAll(req, res, next) {
    try {
      const { page, limit, search } = req.query;
      const result = Project.listAll({
        page:   parseInt(page, 10) || 1,
        limit:  Math.min(parseInt(limit, 10) || 20, 50),
        search: search?.trim() || '',
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  // GET /api/admin/projects/:id
  getById(req, res, next) {
    try {
      const project = Project.findById(parseInt(req.params.id, 10));
      if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
      res.json({ success: true, project });
    } catch (err) { next(err); }
  },

  // POST /api/admin/projects
  create(req, res, next) {
    try {
      const db   = getDb();
      const body = req.body;

      // Resolve or auto-generate slug
      const slug = body.slug?.trim()
        ? body.slug.trim()
        : uniqueProjectSlug(body.title, db);

      // Sanitise all rich-text fields
      const richFields = [
        'overview','problem_statement','dataset_info',
        'methodology','implementation_details','results','future_improvements',
      ];
      const sanitised = {};
      for (const f of richFields) sanitised[f] = sanitizeHtml(body[f] || '');

      const data = {
        slug,
        title:           body.title?.trim() || '',
        category_id:     parseInt(body.category_id, 10) || null,
        short_description: body.short_description?.trim() || '',
        ...sanitised,
        architecture_diagram_path: body.architecture_diagram_path || null,
        workflow_diagram_path:     body.workflow_diagram_path     || null,
        thumbnail_path:  body.thumbnail_path  || null,
        banner_path:     body.banner_path     || null,
        github_url:      body.github_url      || null,
        research_paper_url: body.research_paper_url || null,
        demo_url:        body.demo_url        || null,
        status:          body.status === 'published' ? 'published' : 'draft',
        is_featured:     body.is_featured ? 1 : 0,
        display_order:   parseInt(body.display_order, 10) || 0,
        published_at:    body.status === 'published' ? new Date().toISOString() : null,
      };

      if (!data.title) return res.status(400).json({ success: false, message: 'Title is required.' });

      const id = Project.create(data);

      // Handle technologies (array of names)
      if (Array.isArray(body.technologies)) {
        const techIds = body.technologies.map(name => Skill.findOrCreateTechnology(name).id);
        Project.setTechnologies(id, techIds);
      }

      // Handle tags (array of names)
      if (Array.isArray(body.tags)) {
        const tagIds = body.tags.map(name => Skill.findOrCreateTag(name).id);
        Project.setTags(id, tagIds);
      }

      // Handle metrics
      if (Array.isArray(body.metrics)) {
        Project.replaceMetrics(id, body.metrics);
      }

      // Handle timeline
      if (Array.isArray(body.timeline)) {
        Project.replaceTimeline(id, body.timeline);
      }

      const created = Project.findById(id);
      res.status(201).json({ success: true, message: 'Project created.', project: created });
    } catch (err) { next(err); }
  },

  // PUT /api/admin/projects/:id
  update(req, res, next) {
    try {
      const db  = getDb();
      const id  = parseInt(req.params.id, 10);
      const existing = Project.findById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Project not found.' });

      const body = req.body;
      const slug = body.slug?.trim()
        ? body.slug.trim()
        : uniqueProjectSlug(body.title, db, id);

      const richFields = [
        'overview','problem_statement','dataset_info',
        'methodology','implementation_details','results','future_improvements',
      ];
      const sanitised = {};
      for (const f of richFields) sanitised[f] = sanitizeHtml(body[f] ?? existing[f] ?? '');

      const wasPublished = existing.status === 'published';
      const nowPublished = body.status === 'published';

      const data = {
        slug,
        title:           body.title?.trim()             || existing.title,
        category_id:     parseInt(body.category_id, 10) || existing.category_id || null,
        short_description: body.short_description?.trim() || existing.short_description,
        ...sanitised,
        architecture_diagram_path: body.architecture_diagram_path ?? existing.architecture_diagram_path,
        workflow_diagram_path:     body.workflow_diagram_path     ?? existing.workflow_diagram_path,
        thumbnail_path:  body.thumbnail_path  ?? existing.thumbnail_path,
        banner_path:     body.banner_path     ?? existing.banner_path,
        github_url:      body.github_url      ?? existing.github_url,
        research_paper_url: body.research_paper_url ?? existing.research_paper_url,
        demo_url:        body.demo_url        ?? existing.demo_url,
        status:          nowPublished ? 'published' : 'draft',
        is_featured:     body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : existing.is_featured,
        display_order:   parseInt(body.display_order, 10) ?? existing.display_order,
        published_at:    nowPublished
          ? (wasPublished ? existing.published_at : new Date().toISOString())
          : null,
      };

      Project.update(id, data);

      if (Array.isArray(body.technologies)) {
        const techIds = body.technologies.map(name => Skill.findOrCreateTechnology(name).id);
        Project.setTechnologies(id, techIds);
      }

      if (Array.isArray(body.tags)) {
        const tagIds = body.tags.map(name => Skill.findOrCreateTag(name).id);
        Project.setTags(id, tagIds);
      }

      if (Array.isArray(body.metrics)) Project.replaceMetrics(id, body.metrics);
      if (Array.isArray(body.timeline)) Project.replaceTimeline(id, body.timeline);

      const updated = Project.findById(id);
      res.json({ success: true, message: 'Project updated.', project: updated });
    } catch (err) { next(err); }
  },

  // DELETE /api/admin/projects/:id
  delete(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = Project.findById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Project not found.' });
      Project.delete(id);
      res.json({ success: true, message: 'Project deleted.' });
    } catch (err) { next(err); }
  },

  // POST /api/admin/projects/:id/publish
  publish(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      Project.publish(id);
      res.json({ success: true, message: 'Project published.' });
    } catch (err) { next(err); }
  },

  // POST /api/admin/projects/:id/unpublish
  unpublish(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      Project.unpublish(id);
      res.json({ success: true, message: 'Project moved to draft.' });
    } catch (err) { next(err); }
  },

  // DELETE /api/admin/projects/:projectId/images/:imageId
  deleteImage(req, res, next) {
    try {
      const { projectId, imageId } = req.params;
      const db = getDb();
      const img = db.prepare('SELECT * FROM project_images WHERE id = ? AND project_id = ?')
                    .get(imageId, projectId);
      if (!img) return res.status(404).json({ success: false, message: 'Image not found.' });

      // Delete file from disk
      const fullPath = path.join(process.cwd(), img.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

      Project.deleteImage(imageId, projectId);
      res.json({ success: true, message: 'Image deleted.' });
    } catch (err) { next(err); }
  },
};

module.exports = projectController;
