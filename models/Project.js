// models/Project.js
'use strict';

const { getDb } = require('../config/db');

// ── Internal helpers ───────────────────────────────────────────

/** Attach related arrays to a project row fetched from the projects table */
function _hydrate(project) {
  if (!project) return null;
  const db = getDb();
  const id = project.id;

  project.technologies = db.prepare(`
    SELECT t.id, t.name, t.slug, t.icon
    FROM technologies t
    JOIN project_technologies pt ON pt.technology_id = t.id
    WHERE pt.project_id = ?
    ORDER BY t.name
  `).all(id);

  project.tags = db.prepare(`
    SELECT tg.id, tg.name, tg.slug
    FROM tags tg
    JOIN project_tags ptg ON ptg.tag_id = tg.id
    WHERE ptg.project_id = ?
    ORDER BY tg.name
  `).all(id);

  project.images = db.prepare(`
    SELECT * FROM project_images WHERE project_id = ? ORDER BY sort_order
  `).all(id);

  project.videos = db.prepare(`
    SELECT * FROM project_videos WHERE project_id = ? ORDER BY sort_order
  `).all(id);

  project.documents = db.prepare(`
    SELECT * FROM project_documents WHERE project_id = ? ORDER BY sort_order
  `).all(id);

  project.metrics = db.prepare(`
    SELECT * FROM project_metrics WHERE project_id = ? ORDER BY sort_order
  `).all(id);

  project.timeline = db.prepare(`
    SELECT * FROM project_timeline_events WHERE project_id = ? ORDER BY sort_order
  `).all(id);

  // Related projects — curated first, fallback to same-category
  const curated = db.prepare(`
    SELECT p.id, p.slug, p.title, p.short_description, p.thumbnail_path,
           p.project_status, p.started_on, p.completed_on, c.name AS category
    FROM projects p
    JOIN related_projects rp ON rp.related_project_id = p.id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE rp.project_id = ? AND p.status = 'published'
    LIMIT 3
  `).all(id);

  if (curated.length > 0) {
    project.related = curated;
  } else {
    project.related = db.prepare(`
      SELECT p.id, p.slug, p.title, p.short_description, p.thumbnail_path,
           p.project_status, p.started_on, p.completed_on, c.name AS category
      FROM projects p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.category_id = ? AND p.id != ? AND p.status = 'published'
      ORDER BY p.display_order, p.published_at DESC
      LIMIT 3
    `).all(project.category_id, id);
  }

  return project;
}

// ── Public queries (status = 'published' only) ─────────────────

const Project = {
  /** List published projects with optional search + category filter + pagination */
  listPublished({ categorySlug, projectStatus, search, page = 1, limit = 12 } = {}) {
    const db = getDb();
    const offset = (page - 1) * limit;
    const conditions = ["p.status = 'published'"];
    const params = [];

    if (categorySlug && categorySlug !== 'all') {
      conditions.push('c.slug = ?');
      params.push(categorySlug);
    }
    if (['completed', 'ongoing', 'planned'].includes(projectStatus)) {
      conditions.push('p.project_status = ?');
      params.push(projectStatus);
    }
    if (search) {
      conditions.push(`(
        p.title LIKE ? OR p.short_description LIKE ?
        OR EXISTS (
          SELECT 1 FROM project_tags ptg JOIN tags tg ON tg.id = ptg.tag_id
          WHERE ptg.project_id = p.id AND tg.name LIKE ?
        )
        OR EXISTS (
          SELECT 1 FROM project_technologies pt JOIN technologies t ON t.id = pt.technology_id
          WHERE pt.project_id = p.id AND t.name LIKE ?
        )
      )`);
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = db.prepare(`
      SELECT COUNT(*) AS n
      FROM projects p
      LEFT JOIN categories c ON c.id = p.category_id
      ${where}
    `).get(...params).n;

    const rows = db.prepare(`
      SELECT p.id, p.slug, p.title, p.short_description,
             p.thumbnail_path, p.is_featured, p.display_order,
             p.published_at, p.github_url, p.demo_url,
             p.project_status, p.started_on, p.completed_on,
             c.name AS category, c.slug AS category_slug
      FROM projects p
      LEFT JOIN categories c ON c.id = p.category_id
      ${where}
      ORDER BY p.display_order ASC, p.published_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // Attach technology tags to each card (shown as chips)
    for (const row of rows) {
      row.technologies = db.prepare(`
        SELECT t.name FROM technologies t
        JOIN project_technologies pt ON pt.technology_id = t.id
        WHERE pt.project_id = ? ORDER BY t.name LIMIT 6
      `).all(row.id);
    }

    return {
      projects: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  },

  /** Featured projects for the homepage */
  listFeatured(limit = 6) {
    const db = getDb();
    const rows = db.prepare(`
      SELECT p.id, p.slug, p.title, p.short_description,
             p.thumbnail_path, p.published_at, p.github_url, p.demo_url,
             p.project_status, p.started_on, p.completed_on,
             c.name AS category, c.slug AS category_slug
      FROM projects p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND p.is_featured = 1
      ORDER BY p.display_order ASC, p.published_at DESC
      LIMIT ?
    `).all(limit);

    for (const row of rows) {
      row.technologies = db.prepare(`
        SELECT t.name FROM technologies t
        JOIN project_technologies pt ON pt.technology_id = t.id
        WHERE pt.project_id = ? ORDER BY t.name LIMIT 6
      `).all(row.id);
    }

    return rows;
  },

  /** Full project detail by slug (public — published only) */
  findBySlug(slug) {
    const row = getDb().prepare(`
      SELECT p.*,
             c.name AS category, c.slug AS category_slug
      FROM projects p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ? AND p.status = 'published'
    `).get(slug);
    return _hydrate(row);
  },

  // ── Admin queries (all statuses) ────────────────────────────

  /** List ALL projects for admin dashboard */
  listAll({ page = 1, limit = 20, search = '' } = {}) {
    const db = getDb();
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(p.title LIKE ? OR p.short_description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) AS n FROM projects p ${where}`).get(...params).n;
    const rows  = db.prepare(`
      SELECT p.id, p.slug, p.title, p.short_description,
             p.status, p.is_featured, p.display_order, p.project_status,
             p.thumbnail_path, p.published_at, p.created_at, p.updated_at,
             c.name AS category, c.slug AS category_slug
      FROM projects p
      LEFT JOIN categories c ON c.id = p.category_id
      ${where}
      ORDER BY p.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return { projects: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },

  /** Full project by id (admin — any status) */
  findById(id) {
    const row = getDb().prepare(`
      SELECT p.*, c.name AS category, c.slug AS category_slug
      FROM projects p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
    `).get(id);
    return _hydrate(row);
  },

  /** Create a new project, returns the new row id */
  create(data) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO projects (
        slug, title, category_id,
        short_description, overview, problem_statement, dataset_info,
        methodology, implementation_details, results, future_improvements,
        architecture_diagram_path, workflow_diagram_path,
        thumbnail_path, banner_path,
        github_url, research_paper_url, demo_url,
        status, is_featured, display_order, published_at,
        project_status, started_on, completed_on, my_role, key_learnings
      ) VALUES (
        @slug, @title, @category_id,
        @short_description, @overview, @problem_statement, @dataset_info,
        @methodology, @implementation_details, @results, @future_improvements,
        @architecture_diagram_path, @workflow_diagram_path,
        @thumbnail_path, @banner_path,
        @github_url, @research_paper_url, @demo_url,
        @status, @is_featured, @display_order, @published_at,
        @project_status, @started_on, @completed_on, @my_role, @key_learnings
      )
    `).run(data);
    return result.lastInsertRowid;
  },

  /** Update core project fields */
  update(id, data) {
    return getDb().prepare(`
      UPDATE projects SET
        slug = @slug, title = @title, category_id = @category_id,
        short_description = @short_description, overview = @overview,
        problem_statement = @problem_statement, dataset_info = @dataset_info,
        methodology = @methodology, implementation_details = @implementation_details,
        results = @results, future_improvements = @future_improvements,
        architecture_diagram_path = @architecture_diagram_path,
        workflow_diagram_path = @workflow_diagram_path,
        thumbnail_path = @thumbnail_path, banner_path = @banner_path,
        github_url = @github_url, research_paper_url = @research_paper_url,
        demo_url = @demo_url, status = @status,
        is_featured = @is_featured, display_order = @display_order,
        published_at = @published_at,
        project_status = @project_status, started_on = @started_on,
        completed_on = @completed_on, my_role = @my_role, key_learnings = @key_learnings
      WHERE id = @id
    `).run({ ...data, id });
  },

  /** Delete a project and all its children (CASCADE handles child rows) */
  delete(id) {
    return getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
  },

  publish(id) {
    return getDb().prepare(`
      UPDATE projects SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);
  },

  unpublish(id) {
    return getDb().prepare(`
      UPDATE projects SET status = 'draft', published_at = NULL WHERE id = ?
    `).run(id);
  },

  // ── Join-table helpers ─────────────────────────────────────

  setTechnologies(projectId, technologyIds) {
    const db = getDb();
    db.prepare('DELETE FROM project_technologies WHERE project_id = ?').run(projectId);
    const ins = db.prepare('INSERT OR IGNORE INTO project_technologies VALUES (?, ?)');
    for (const tid of technologyIds) ins.run(projectId, tid);
  },

  setTags(projectId, tagIds) {
    const db = getDb();
    db.prepare('DELETE FROM project_tags WHERE project_id = ?').run(projectId);
    const ins = db.prepare('INSERT OR IGNORE INTO project_tags VALUES (?, ?)');
    for (const tid of tagIds) ins.run(projectId, tid);
  },

  setRelated(projectId, relatedIds) {
    const db = getDb();
    // Links are stored in both directions, so clear both before re-linking
    db.prepare('DELETE FROM related_projects WHERE project_id = ? OR related_project_id = ?').run(projectId, projectId);
    const ins = db.prepare('INSERT OR IGNORE INTO related_projects VALUES (?, ?)');
    const exists = db.prepare('SELECT 1 FROM projects WHERE id = ?');
    for (const rid of relatedIds) {
      if (rid === projectId || !exists.get(rid)) continue;
      ins.run(projectId, rid);
      ins.run(rid, projectId);  // symmetric
    }
  },

  /** Ids of projects curated as related to this one (admin form) */
  relatedIds(projectId) {
    return getDb().prepare('SELECT related_project_id AS id FROM related_projects WHERE project_id = ?')
      .all(projectId).map((r) => r.id);
  },

  /** Every uploaded-file path a project references (for cleanup) */
  filePaths(projectId) {
    const db = getDb();
    const p = db.prepare(`
      SELECT thumbnail_path, banner_path, architecture_diagram_path, workflow_diagram_path
      FROM projects WHERE id = ?
    `).get(projectId) || {};
    return [
      ...Object.values(p),
      ...db.prepare('SELECT file_path FROM project_images WHERE project_id = ?').all(projectId).map((r) => r.file_path),
      ...db.prepare('SELECT file_path FROM project_videos WHERE project_id = ?').all(projectId).map((r) => r.file_path),
      ...db.prepare('SELECT file_path FROM project_documents WHERE project_id = ?').all(projectId).map((r) => r.file_path),
    ].filter(Boolean);
  },

  // ── Media lists (replaced wholesale from the admin form) ────

  replaceImages(projectId, images) {
    const db = getDb();
    db.prepare('DELETE FROM project_images WHERE project_id = ?').run(projectId);
    const ins = db.prepare(`
      INSERT INTO project_images (project_id, file_path, alt_text, caption, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    images.forEach((img, i) => ins.run(projectId, img.file_path, img.alt_text || null, img.caption || null, i));
  },

  replaceVideos(projectId, videos) {
    const db = getDb();
    db.prepare('DELETE FROM project_videos WHERE project_id = ?').run(projectId);
    const ins = db.prepare(`
      INSERT INTO project_videos (project_id, source_type, file_path, external_url, title, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    videos.forEach((v, i) => ins.run(
      projectId, v.source_type,
      v.source_type === 'upload' ? v.file_path : null,
      v.source_type === 'external' ? v.external_url : null,
      v.title || null, i,
    ));
  },

  replaceDocuments(projectId, docs) {
    const db = getDb();
    db.prepare('DELETE FROM project_documents WHERE project_id = ?').run(projectId);
    const ins = db.prepare(`
      INSERT INTO project_documents (project_id, file_path, label, sort_order)
      VALUES (?, ?, ?, ?)
    `);
    docs.forEach((d, i) => ins.run(projectId, d.file_path, d.label || 'Document', i));
  },

  // ── Metrics / timeline ─────────────────────────────────────

  replaceMetrics(projectId, metrics) {
    const db = getDb();
    db.prepare('DELETE FROM project_metrics WHERE project_id = ?').run(projectId);
    const ins = db.prepare(`
      INSERT INTO project_metrics (project_id, metric_label, metric_value, sort_order)
      VALUES (?, ?, ?, ?)
    `);
    metrics.forEach((m, i) => ins.run(projectId, m.label, m.value, i));
  },

  replaceTimeline(projectId, events) {
    const db = getDb();
    db.prepare('DELETE FROM project_timeline_events WHERE project_id = ?').run(projectId);
    const ins = db.prepare(`
      INSERT INTO project_timeline_events (project_id, title, description, date_label, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    events.forEach((e, i) => ins.run(projectId, e.title, e.description || null, e.date_label || null, i));
  },

  // ── Media records ──────────────────────────────────────────

  addImage(projectId, filePath, altText, caption, sortOrder = 0) {
    return getDb().prepare(`
      INSERT INTO project_images (project_id, file_path, alt_text, caption, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(projectId, filePath, altText, caption, sortOrder);
  },

  deleteImage(imageId, projectId) {
    return getDb().prepare(
      'DELETE FROM project_images WHERE id = ? AND project_id = ?'
    ).run(imageId, projectId);
  },

  addVideo(projectId, data) {
    return getDb().prepare(`
      INSERT INTO project_videos (project_id, source_type, file_path, external_url, title, sort_order)
      VALUES (@project_id, @source_type, @file_path, @external_url, @title, @sort_order)
    `).run({ project_id: projectId, sort_order: 0, ...data });
  },

  deleteVideo(videoId, projectId) {
    return getDb().prepare(
      'DELETE FROM project_videos WHERE id = ? AND project_id = ?'
    ).run(videoId, projectId);
  },

  addDocument(projectId, filePath, label, sortOrder = 0) {
    return getDb().prepare(`
      INSERT INTO project_documents (project_id, file_path, label, sort_order)
      VALUES (?, ?, ?, ?)
    `).run(projectId, filePath, label, sortOrder);
  },

  deleteDocument(docId, projectId) {
    return getDb().prepare(
      'DELETE FROM project_documents WHERE id = ? AND project_id = ?'
    ).run(docId, projectId);
  },

  // ── Dashboard stats ────────────────────────────────────────

  stats() {
    const db = getDb();
    return {
      total:     db.prepare("SELECT COUNT(*) AS n FROM projects").get().n,
      published: db.prepare("SELECT COUNT(*) AS n FROM projects WHERE status = 'published'").get().n,
      drafts:    db.prepare("SELECT COUNT(*) AS n FROM projects WHERE status = 'draft'").get().n,
      featured:  db.prepare("SELECT COUNT(*) AS n FROM projects WHERE is_featured = 1").get().n,
      recent:    db.prepare(`
        SELECT p.id, p.slug, p.title, p.status, p.thumbnail_path,
               p.updated_at, c.name AS category
        FROM projects p
        LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.updated_at DESC LIMIT 5
      `).all(),
    };
  },
};

module.exports = Project;
