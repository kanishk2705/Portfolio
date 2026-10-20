# Kanishk — AI/ML Portfolio

My personal portfolio and project showcase: a self-hosted site with a no-code admin
panel, so new projects, skills, milestones and certifications can be added without
touching code. Built with vanilla HTML/CSS/JS on the frontend and Node.js + Express +
SQLite on the backend.

## Features

**Public site**
- Home: hero, about + live stats, research interests, featured projects, education &
  experience, skills, journey timeline, certifications, contact. Sections with no
  content yet are hidden automatically.
- Projects archive with search, category and status (completed / ongoing / planned)
  filters and pagination
- Project detail pages: status and dates, rich write-up sections (including "My Role"
  and "What I Learned"), metrics, diagrams, gallery + lightbox, videos
  (upload / YouTube / Vimeo), documents, build timeline, related projects
- CV download at a stable `/cv.pdf` address
- Light/dark theme, responsive layout, scroll animations
- Server-rendered SEO: titles, descriptions, canonical URLs, Open Graph / Twitter cards,
  JSON-LD, `sitemap.xml`, `robots.txt`

**Admin panel** (`/admin`)
- Projects: create / edit / publish / feature, status + start/completion month,
  rich-text editor, drag-and-drop media, **Import from GitHub** (fills the form from
  a public repo's README for review)
- Profile: research interests, education, experience, homepage journey
- Categories, certifications, skills (cards + individual skills)
- Site settings: name, hero, about, contact, CV upload, link-preview image, footer

**Security**: JWT httpOnly cookie auth, CSRF double-submit, rate limiting, input
validation, HTML sanitising, Helmet security headers.

## Stack

- **Frontend:** HTML5, CSS3 (design-token system, light/dark theme), vanilla JS
- **Backend:** Node.js 24, Express
- **Database:** SQLite (`better-sqlite3`)
- **Deployment:** Render (see [DEPLOY.md](DEPLOY.md))

## Local setup

```bash
npm install
cp .env.example .env        # then fill in real secrets
npm run build:db            # creates database/portfolio.db from schema.sql
npm run seed                # admin login + default content (safe to re-run)
npm run dev                 # http://localhost:3000, admin at /admin/login
```

## Project structure

- `views/` — public page templates, filled with live settings + SEO on the server
  - `views/partials/` — shared `<head>`, nav and footer used by every page
- `public/` — static assets (CSS, JS, images) and the admin pages
- `routes/` + `controllers/` + `models/` — backend API, organised by resource
- `middleware/` — auth, CSRF, validation, uploads, rate limiting
- `utils/` — template renderer, SEO helpers, upload-file helpers, sanitiser
- `database/` — schema, migrations (applied automatically on startup) and seed data
- `uploads/` — uploaded media (git-ignored; set `UPLOADS_PATH` to move it)

### Adding a public page

1. Create `views/<page>.html` using `{{> head }}`, `{{> nav }}` and `{{> footer }}`.
2. Add a route in `server.js` that calls `renderPage('<page>.html', { 'seo.head': buildHead(...) })`.

Template syntax is documented at the top of `utils/render.js`.
