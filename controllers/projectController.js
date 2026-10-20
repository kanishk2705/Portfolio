// controllers/projectController.js
'use strict';

const Project = require('../models/Project');
const Skill   = require('../models/Skill');
const { getDb } = require('../config/db');
const { slugify, uniqueProjectSlug } = require('../utils/slugify');
const { sanitizeHtml }      = require('../utils/sanitize');
const { removeUnreferenced } = require('../utils/uploads');
const { importFromGithub, ImportError } = require('../utils/githubImport');

const RICH_FIELDS = [
  'overview', 'problem_statement', 'dataset_info',
  'methodology', 'implementation_details', 'results', 'future_improvements',
  'my_role', 'key_learnings',
];

/** Build the core projects-row data from a request body, falling back to `existing`. */
function buildProjectData(body, existing, slug) {
  const pick = (field) => (body[field] !== undefined ? (body[field] || null) : (existing?.[field] ?? null));

  const sanitised = {};
  for (const f of RICH_FIELDS) sanitised[f] = sanitizeHtml(body[f] ?? existing?.[f] ?? '');

  const nowPublished = body.status !== undefined
    ? body.status === 'published'
    : existing?.status === 'published';
  const wasPublished = existing?.status === 'published';

  const order = parseInt(body.display_order, 10);

  return {
    slug,
    title:             body.title?.trim() || existing?.title || '',
    // An explicit null/'' clears the category; undefined keeps the old one
    category_id:       body.category_id !== undefined
      ? (parseInt(body.category_id, 10) || null)
      : (existing?.category_id ?? null),
    short_description: body.short_description?.trim() || existing?.short_description || '',
    ...sanitised,
    architecture_diagram_path: pick('architecture_diagram_path'),
    workflow_diagram_path:     pick('workflow_diagram_path'),
    thumbnail_path:     pick('thumbnail_path'),
    banner_path:        pick('banner_path'),
    github_url:         pick('github_url'),
    research_paper_url: pick('research_paper_url'),
    demo_url:           pick('demo_url'),
    status:             nowPublished ? 'published' : 'draft',
    project_status:     body.project_status || existing?.project_status || 'completed',
    started_on:         pick('started_on'),
    // Only completed projects have a completion month
    completed_on:       (body.project_status || existing?.project_status) === 'completed' ? pick('completed_on') : null,
    is_featured:        body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : (existing?.is_featured ?? 0),
    display_order:      Number.isNaN(order) ? (existing?.display_order ?? 0) : order,
    published_at:       nowPublished
      ? (wasPublished && existing.published_at ? existing.published_at : new Date().toISOString())
      : null,
  };
}

/** Save the list/relationship parts of a project. Only fields present in the body are touched. */
function saveRelations(id, body) {
  if (Array.isArray(body.technologies)) {
    Project.setTechnologies(id, body.technologies.map((name) => Skill.findOrCreateTechnology(name).id));
  }
  if (Array.isArray(body.tags)) {
    Project.setTags(id, body.tags.map((name) => Skill.findOrCreateTag(name).id));
  }
  if (Array.isArray(body.metrics))     Project.replaceMetrics(id, body.metrics);
  if (Array.isArray(body.timeline))    Project.replaceTimeline(id, body.timeline);
  if (Array.isArray(body.images))      Project.replaceImages(id, body.images);
  if (Array.isArray(body.videos))      Project.replaceVideos(id, body.videos);
  if (Array.isArray(body.documents))   Project.replaceDocuments(id, body.documents);
  if (Array.isArray(body.related_ids)) Project.setRelated(id, body.related_ids);
}

function withRelatedIds(project) {
  if (project) project.related_ids = Project.relatedIds(project.id);
  return project;
}

// ── Public controllers ─────────────────────────────────────────

const projectController = {
  // GET /api/projects
  listPublished(req, res, next) {
    try {
      const { category, status, search, page, limit } = req.query;
      const result = Project.listPublished({
        categorySlug: category,
        projectStatus: status,
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

  // GET /api/admin/projects/options — id/title of every project (related-projects picker)
  listOptions(req, res, next) {
    try {
      const projects = getDb().prepare('SELECT id, title, status FROM projects ORDER BY title').all();
      res.json({ success: true, projects });
    } catch (err) { next(err); }
  },

  // POST /api/admin/projects/import/github  { url }
  // Returns draft field values for the form — nothing is saved.
  async importGithub(req, res, next) {
    try {
      const result = await importFromGithub(req.body?.url);
      res.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof ImportError) return res.status(err.status).json({ success: false, message: err.message });
      next(err);
    }
  },

  // GET /api/admin/projects/:id
  getById(req, res, next) {
    try {
      const project = withRelatedIds(Project.findById(parseInt(req.params.id, 10)));
      if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
      res.json({ success: true, project });
    } catch (err) { next(err); }
  },

  // POST /api/admin/projects
  create(req, res, next) {
    try {
      const db   = getDb();
      const body = req.body;
      const slug = slugify(body.slug || '') || uniqueProjectSlug(body.title, db);

      const data = buildProjectData(body, null, slug);
      if (!data.title) return res.status(400).json({ success: false, message: 'Title is required.' });

      const id = db.transaction(() => {
        const newId = Project.create(data);
        saveRelations(newId, body);
        return newId;
      })();

      const created = withRelatedIds(Project.findById(id));
      res.status(201).json({ success: true, message: 'Project created.', project: created });
    } catch (err) {
      if (/UNIQUE constraint failed: projects.slug/.test(err.message)) {
        return res.status(409).json({ success: false, message: 'Another project already uses that slug.' });
      }
      next(err);
    }
  },

  // PUT /api/admin/projects/:id
  update(req, res, next) {
    try {
      const db  = getDb();
      const id  = parseInt(req.params.id, 10);
      const existing = Project.findById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Project not found.' });

      const body = req.body;
      const slug = slugify(body.slug || '') || uniqueProjectSlug(body.title || existing.title, db, id);
      const filesBefore = Project.filePaths(id);

      db.transaction(() => {
        Project.update(id, buildProjectData(body, existing, slug));
        saveRelations(id, body);
      })();

      removeUnreferenced(filesBefore);

      const updated = withRelatedIds(Project.findById(id));
      res.json({ success: true, message: 'Project updated.', project: updated });
    } catch (err) {
      if (/UNIQUE constraint failed: projects.slug/.test(err.message)) {
        return res.status(409).json({ success: false, message: 'Another project already uses that slug.' });
      }
      next(err);
    }
  },

  // DELETE /api/admin/projects/:id
  delete(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = Project.findById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Project not found.' });
      const files = Project.filePaths(id);
      Project.delete(id);
      removeUnreferenced(files);
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
      const img = getDb().prepare('SELECT * FROM project_images WHERE id = ? AND project_id = ?')
                    .get(imageId, projectId);
      if (!img) return res.status(404).json({ success: false, message: 'Image not found.' });
      Project.deleteImage(imageId, projectId);
      removeUnreferenced([img.file_path]);
      res.json({ success: true, message: 'Image deleted.' });
    } catch (err) { next(err); }
  },

  // DELETE /api/admin/projects/:projectId/videos/:videoId
  deleteVideo(req, res, next) {
    try {
      const { projectId, videoId } = req.params;
      const video = getDb().prepare('SELECT * FROM project_videos WHERE id = ? AND project_id = ?')
                      .get(videoId, projectId);
      if (!video) return res.status(404).json({ success: false, message: 'Video not found.' });
      Project.deleteVideo(videoId, projectId);
      removeUnreferenced([video.file_path]);
      res.json({ success: true, message: 'Video deleted.' });
    } catch (err) { next(err); }
  },

  // DELETE /api/admin/projects/:projectId/documents/:docId
  deleteDocument(req, res, next) {
    try {
      const { projectId, docId } = req.params;
      const doc = getDb().prepare('SELECT * FROM project_documents WHERE id = ? AND project_id = ?')
                    .get(docId, projectId);
      if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });
      Project.deleteDocument(docId, projectId);
      removeUnreferenced([doc.file_path]);
      res.json({ success: true, message: 'Document deleted.' });
    } catch (err) { next(err); }
  },
};

module.exports = projectController;
