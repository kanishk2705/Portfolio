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
- **Hosting:** GitHub Pages, as a static export (see [DEPLOY.md](DEPLOY.md))

## Local setup

```bash
npm install
cp .env.example .env        # then fill in real secrets
npm run build:db            # creates database/portfolio.db from schema.sql
npm run seed                # admin login + default content (safe to re-run)
npm run dev                 # http://localhost:3000, admin at /admin/login
```

## Publishing

The live site is a static build on GitHub Pages — **https://kanishk2705.github.io/Portfolio/**.
Edit content locally, then:

```bash
npm run deploy              # build dist/ and push it to the gh-pages branch
```

Full guide, backups and custom domain: [DEPLOY.md](DEPLOY.md).

## Project structure

- `views/` — public page templates, filled with live settings + SEO on the server
  - `views/partials/` — shared `<head>`, nav and footer used by every page
- `public/` — static assets (CSS, JS, images) and the admin pages
- `routes/` + `controllers/` + `models/` — backend API, organised by resource
- `middleware/` — auth, CSRF, validation, uploads, rate limiting
- `utils/` — page builders, template renderer, SEO helpers, GitHub import, upload helpers, sanitiser
- `scripts/` — `export.js` (static build to `dist/`) and `deploy.js` (push to GitHub Pages)
- `database/` — schema, migrations (applied automatically on startup) and seed data
- `uploads/` — uploaded media (git-ignored; set `UPLOADS_PATH` to move it)

### Adding a public page

1. Create `views/<page>.html` using `{{> head }}`, `{{> nav }}` and `{{> footer }}`.
2. Add a builder in `utils/pages.js`, a route in `server.js` that calls it, and a
   `writePage(...)` line in `scripts/export.js` so the static build includes it.

Template syntax is documented at the top of `utils/render.js`.
