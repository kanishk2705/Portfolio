# AI/ML Portfolio Platform

A self-hosted, no-code-to-update portfolio and project showcase platform, built with
vanilla HTML/CSS/JS on the frontend and Node.js + Express + SQLite on the backend.

> Status: under construction, built in phases. This README grows with each phase.

## Phase log

- [x] Phase 1 — Folder structure & project scaffolding
- [x] Phase 2 — Database design (schema.sql, seed script)
- [x] Phase 3 — Backend (routes, controllers, models, server.js)
- [x] Phase 4 — Frontend layout (Home, Projects, Project Detail)
- [x] Phase 5 — Admin dashboard (login, stats, projects table, drawer, categories, certs, settings)
- [x] Phase 6 — Project management (rich-text editor, drag-and-drop uploads, tabbed drawer)
- [x] Phase 7 — Security hardening (JWT cookie auth, CSRF, rate limiting, input validation, Helmet)
- [x] Phase 8 — SEO + Render deployment (sitemap.xml, JSON-LD, robots.txt, DEPLOY.md)

## Stack

- **Frontend:** HTML5, CSS3 (custom design-token system, light/dark theme), vanilla JS
- **Backend:** Node.js, Express
- **Database:** SQLite (`better-sqlite3`)
- **Auth:** JWT signed token, delivered as an httpOnly cookie + CSRF double-submit cookie
- **Deployment:** Render (see `render.yaml`)

## Local setup (will work fully starting Phase 3)

```bash
npm install
cp .env.example .env        # then fill in real secrets
npm run build:db            # creates database/portfolio.db from schema.sql
npm run seed                # creates your admin login from .env ADMIN_EMAIL/ADMIN_PASSWORD
npm run dev                 # starts the server with nodemon on PORT (default 3000)
```

## A note on SQLite + Render

Render's free web service tier has an **ephemeral filesystem** — anything written to disk
(including a SQLite file) is wiped on every deploy or restart. To keep your projects and
uploaded media permanently, you'll need Render's **persistent disk** add-on, which requires
a paid instance type. `render.yaml` is already wired for this (see the `disk:` block). This
gets covered in detail in Phase 8 — flagging it now so it's not a surprise at deploy time.

## Project structure

See the folder tree shared in Phase 1 of the build conversation. Briefly:

- `database/` — schema and seed data
- `routes/` + `controllers/` + `models/` — backend API, organized by resource
- `middleware/` — auth, CSRF, upload handling, rate limiting
- `public/` — every static asset actually served to visitors (HTML/CSS/JS/images)
- `uploads/` — user-uploaded media, organized by type, git-ignored
