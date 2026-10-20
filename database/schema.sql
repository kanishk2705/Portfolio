-- ============================================================
-- AI/ML Portfolio Platform — Database Schema (SQLite)
-- ============================================================
-- Run via: npm run build:db  (executes database/init.js, which
-- loads this file and applies it idempotently — safe to re-run).
--
-- Foreign keys are enforced at the connection level, not by
-- this file alone. Every connection opened in config/db.js
-- (Phase 3) must run `PRAGMA foreign_keys = ON;` — SQLite does
-- not enforce FKs by default even if the schema declares them.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- USERS — single-admin auth. Built for one owner account, but
-- not hard-capped at the schema level in case that ever changes.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
    last_login_at   TEXT,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- CATEGORIES — drives the Projects page filter chips
-- (All / Machine Learning / Deep Learning / Data Science / ...)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories (sort_order);

-- ------------------------------------------------------------
-- TECHNOLOGIES — reusable tech-stack chips ("Python", "PyTorch")
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS technologies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    slug            TEXT NOT NULL UNIQUE,
    icon            TEXT,                   -- optional icon identifier/path
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- TAGS — free-form search/filter keywords, separate from tech
-- stack (e.g. "time-series", "healthcare", "real-time")
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    slug            TEXT NOT NULL UNIQUE,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- PROJECTS — the core table. Every field from your project
-- detail spec that is a single value (not a list/many-to-many)
-- lives directly here.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    slug                    TEXT NOT NULL UNIQUE,
    title                   TEXT NOT NULL,
    category_id             INTEGER REFERENCES categories(id) ON DELETE SET NULL,

    short_description       TEXT NOT NULL,
    overview                TEXT,                 -- rich text (HTML from the editor)
    problem_statement       TEXT,                 -- rich text
    dataset_info            TEXT,                 -- rich text
    methodology             TEXT,                 -- rich text
    implementation_details  TEXT,                 -- rich text
    results                 TEXT,                 -- rich text
    future_improvements     TEXT,                 -- rich text

    architecture_diagram_path TEXT,                -- single image, distinct from gallery
    workflow_diagram_path     TEXT,                -- single image, distinct from gallery
    thumbnail_path           TEXT,                 -- shown on cards
    banner_path              TEXT,                 -- shown on the detail page header

    github_url              TEXT,
    research_paper_url      TEXT,
    demo_url                TEXT,                  -- live demo link

    status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    is_featured             INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
    display_order           INTEGER NOT NULL DEFAULT 0,

    -- Where the project stands, shown as a badge on cards and the detail page.
    -- Separate from `status` (draft/published), which controls visibility.
    project_status          TEXT NOT NULL DEFAULT 'completed'
                            CHECK (project_status IN ('completed', 'ongoing', 'planned')),
    started_on              TEXT,                  -- "YYYY-MM"
    completed_on            TEXT,                  -- "YYYY-MM"
    my_role                 TEXT,                  -- rich text: what *you* did
    key_learnings           TEXT,                  -- rich text: what you learned

    published_at            TEXT,
    created_at              TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_status        ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_category       ON projects (category_id);
CREATE INDEX IF NOT EXISTS idx_projects_featured       ON projects (is_featured);
CREATE INDEX IF NOT EXISTS idx_projects_display_order  ON projects (display_order);
CREATE INDEX IF NOT EXISTS idx_projects_published_at   ON projects (published_at);

-- Keep updated_at honest on every UPDATE
CREATE TRIGGER IF NOT EXISTS trg_projects_updated_at
AFTER UPDATE ON projects
FOR EACH ROW
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- ------------------------------------------------------------
-- PROJECT_IMAGES — the gallery/screenshots (many per project)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_images (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,
    alt_text        TEXT,
    caption         TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_images_project ON project_images (project_id, sort_order);

-- ------------------------------------------------------------
-- PROJECT_VIDEOS — uploaded demo videos OR an external link
-- (e.g. a YouTube URL), many per project
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_videos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_type     TEXT NOT NULL CHECK (source_type IN ('upload', 'external')),
    file_path       TEXT,           -- set when source_type = 'upload'
    external_url    TEXT,           -- set when source_type = 'external'
    title           TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_videos_project ON project_videos (project_id, sort_order);

-- ------------------------------------------------------------
-- PROJECT_DOCUMENTS — PDF reports, research papers, etc.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_documents (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,
    label           TEXT NOT NULL DEFAULT 'Report',  -- e.g. "Project Report", "Paper PDF"
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project ON project_documents (project_id, sort_order);

-- ------------------------------------------------------------
-- PROJECT_METRICS — result stat cards (label/value pairs)
-- e.g. ("Accuracy", "94.2%"), ("F1 Score", "0.89")
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_metrics (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    metric_label    TEXT NOT NULL,
    metric_value    TEXT NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_project_metrics_project ON project_metrics (project_id, sort_order);

-- ------------------------------------------------------------
-- PROJECT_TIMELINE_EVENTS — per-project build timeline
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_timeline_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    date_label      TEXT,            -- free text, e.g. "Week 1" or "Mar 2026"
    sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_project_timeline_project ON project_timeline_events (project_id, sort_order);

-- ------------------------------------------------------------
-- JOIN TABLES — project <-> technologies, project <-> tags
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_technologies (
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    technology_id   INTEGER NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, technology_id)
);

CREATE INDEX IF NOT EXISTS idx_project_tech_reverse ON project_technologies (technology_id);

CREATE TABLE IF NOT EXISTS project_tags (
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_project_tags_reverse ON project_tags (tag_id);

-- ------------------------------------------------------------
-- RELATED_PROJECTS — manual curation; self-referencing M:M.
-- Symmetric by convention: when admin links A -> B, the backend
-- (Phase 3) writes both directions so it shows on either page.
-- If a project has zero rows here, the backend falls back to
-- "same category" suggestions automatically.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS related_projects (
    project_id          INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    related_project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, related_project_id),
    CHECK (project_id != related_project_id)
);

-- ------------------------------------------------------------
-- SKILL_CATEGORIES — the 9 cards in the homepage Skills section
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_categories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    icon            TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- SKILLS — individual chips nested inside a skill category card
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_category_id   INTEGER NOT NULL REFERENCES skill_categories(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    proficiency         INTEGER CHECK (proficiency BETWEEN 1 AND 100),
    sort_order          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills (skill_category_id, sort_order);

-- ------------------------------------------------------------
-- CERTIFICATES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    issuer          TEXT NOT NULL,
    issue_date      TEXT,                 -- free text, e.g. "March 2026"
    credential_url  TEXT,
    image_path      TEXT,                 -- optional certificate badge/image
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_certificates_sort ON certificates (sort_order);

-- ------------------------------------------------------------
-- EDUCATION — degrees, shown in the homepage Background section
-- Dates are free text ("Aug 2022", "Expected May 2026").
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS education (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    institution     TEXT NOT NULL,
    degree          TEXT NOT NULL,          -- "B.E. Computer Science and Engineering"
    location        TEXT,
    start_label     TEXT,
    end_label       TEXT,
    grade           TEXT,                   -- "CGPA 8.4 / 10"
    highlights      TEXT,                   -- one item per line → bullet list
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- EXPERIENCE — internships, jobs, research positions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experience (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    role            TEXT NOT NULL,
    organization    TEXT NOT NULL,
    organization_url TEXT,
    location        TEXT,
    employment_type TEXT,                   -- Internship / Research / Full-time / …
    start_label     TEXT,
    end_label       TEXT,                   -- "Present" for current roles
    highlights      TEXT,                   -- one item per line → bullet list
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- SETTINGS — flexible key/value store for site-wide editable
-- content (hero copy, contact links, resume file, etc.) so
-- those can move out of static HTML and into the admin flow.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_settings_updated_at
AFTER UPDATE ON settings
FOR EACH ROW
BEGIN
    UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE key = OLD.key;
END;
