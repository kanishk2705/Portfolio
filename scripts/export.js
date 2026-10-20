// scripts/export.js
// ---------------------------------------------------------------
// Builds the whole public site as static files in dist/, ready for
// GitHub Pages (or any static host). Run with: npm run export
//
//   dist/index.html, projects/, project/<slug>/   pages (same HTML as the server)
//   dist/api/*.json                               data the page scripts read
//   dist/assets/, uploads/, cv.pdf                files (only what is published)
//   dist/sitemap.xml, 404.html, .nojekyll, CNAME  hosting extras
//
// The site URL comes from EXPORT_SITE_URL, or is worked out from the
// git remote: github.com/<user>/<repo> → https://<user>.github.io/<repo>.
// Drafts, draft-only media and the admin panel are never exported.
// ---------------------------------------------------------------
'use strict';

const path = require('path');
const fs   = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
process.chdir(ROOT);  // .env, database and uploads paths are relative to the project
require('../config/env');

const { getDb }       = require('../config/db');
const Project         = require('../models/Project');
const Category        = require('../models/Category');
const Skill           = require('../models/Skill');
const Certificate     = require('../models/Certificate');
const Profile         = require('../models/Profile');
const Setting         = require('../models/Setting');
const { homePage, projectsPage, projectPage } = require('../utils/pages');
const { generateSitemap } = require('../utils/seo');
const { resolveUploadPath } = require('../utils/uploads');

const OUT        = path.join(ROOT, 'dist');
const PUBLIC_DIR = path.join(ROOT, 'public');

// Admin-only files that must not ship with the public site
const ADMIN_FILES = new Set([
  'admin-dashboard.html', 'admin-login.html',
  'assets/js/admin-api.js', 'assets/js/admin-dashboard.js', 'assets/js/admin-login.js',
  'assets/js/editor.js', 'assets/js/uploader.js',
  'assets/css/admin.css', 'assets/css/editor.css',
]);

function resolveSiteUrl() {
  if (process.env.EXPORT_SITE_URL) return process.env.EXPORT_SITE_URL.replace(/\/$/, '');
  let remote = '';
  try { remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim(); } catch { /* no git */ }
  const m = remote.match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/i);
  if (!m) throw new Error('Set EXPORT_SITE_URL in .env (e.g. https://<user>.github.io/<repo>).');
  const [, user, repo] = m;
  return repo.toLowerCase() === `${user.toLowerCase()}.github.io`
    ? `https://${user.toLowerCase()}.github.io`
    : `https://${user.toLowerCase()}.github.io/${repo}`;
}

function exportSite({ log = console.log } = {}) {
  const siteUrl = resolveSiteUrl();
  const { hostname, pathname } = new URL(siteUrl);
  const base = pathname.replace(/\/$/, '');  // "/Portfolio", or "" at a domain root

  // ── Helpers ────────────────────────────────────────────────
  // Root-relative links in HTML ("/projects", "/uploads/x.png") → under the base path
  const prefixHtml = (html) => (base ? html.replace(/(\s(?:href|src)=")\/(?!\/)/g, `$1${base}/`) : html);

  const uploads = new Set();  // every /uploads/... file the published site references
  const collect = (str) => { for (const m of str.matchAll(/\/uploads\/[\w\-./]+/g)) uploads.add(m[0]); };

  // Deep-copy JSON data: note uploads, prefix site paths in plain values and in HTML
  const prepare = (value) => {
    if (typeof value === 'string') {
      collect(value);
      if (/^\/(uploads|assets)\//.test(value)) return base + value;
      return value.includes('<') ? prefixHtml(value) : value;
    }
    if (Array.isArray(value)) return value.map(prepare);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, prepare(v)]));
    }
    return value;
  };

  const write = (rel, content) => {
    const file = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  const writeJson = (rel, data) => write(rel, JSON.stringify(prepare({ success: true, ...data })));
  const writePage = (rel, html) => { collect(html); write(rel, prefixHtml(html)); };

  // ── Start clean ────────────────────────────────────────────
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // ── Static assets ──────────────────────────────────────────
  fs.cpSync(PUBLIC_DIR, OUT, {
    recursive: true,
    filter: (src) => !ADMIN_FILES.has(path.relative(PUBLIC_DIR, src).split(path.sep).join('/')),
  });

  // ── Pages ──────────────────────────────────────────────────
  const extra = { 'site.base': base, 'site.mode': 'static' };
  const projects = Project.listPublishedIndex();

  writePage('index.html', homePage(siteUrl, extra));
  writePage('projects/index.html', projectsPage(siteUrl, extra));
  for (const p of projects) {
    writePage(`project/${p.slug}/index.html`, projectPage(p.slug, siteUrl, extra).html);
  }
  // GitHub Pages serves 404.html for unknown paths; project.js shows "not found"
  writePage('404.html', projectPage(null, siteUrl, extra).html);

  // ── Data for the page scripts (mirrors the public API) ─────
  writeJson('api/projects.json', { projects });
  for (const p of projects) writeJson(`api/projects/${p.slug}.json`, { project: Project.findBySlug(p.slug) });
  writeJson('api/categories.json',   { categories: Category.listWithCounts() });
  writeJson('api/skills.json',       { skillCategories: Skill.listAllCategories() });
  writeJson('api/certificates.json', { certificates: Certificate.listAll() });
  writeJson('api/education.json',    { items: Profile.listEducation() });
  writeJson('api/experience.json',   { items: Profile.listExperience() });
  const settings = Setting.publicAll();
  writeJson('api/settings.json',     { settings });

  // ── Uploaded files that published content uses ────────────
  let missing = 0;
  for (const p of projects) Project.filePaths(p.id).forEach((f) => uploads.add(f));
  for (const publicPath of uploads) {
    const src = resolveUploadPath(publicPath);
    if (src && fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(path.join(OUT, publicPath)), { recursive: true });
      fs.copyFileSync(src, path.join(OUT, publicPath));
    } else {
      missing++;
      log(`  ! referenced file not found: ${publicPath}`);
    }
  }

  // ── CV at its stable address ───────────────────────────────
  const cv = resolveUploadPath(settings['cv.file']);
  if (cv && fs.existsSync(cv)) fs.copyFileSync(cv, path.join(OUT, 'cv.pdf'));

  // ── Hosting extras ─────────────────────────────────────────
  write('sitemap.xml', generateSitemap(getDb(), siteUrl));
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
  write('.nojekyll', '');  // serve files as-is, no Jekyll processing
  if (!hostname.endsWith('.github.io')) write('CNAME', `${hostname}\n`);  // custom domain

  log(`Exported ${projects.length} project page(s) and ${uploads.size - missing} file(s) to dist/`);
  log(`Site URL: ${siteUrl}/`);
  return { siteUrl, out: OUT, projects: projects.length };
}

module.exports = { exportSite };

if (require.main === module) {
  try {
    exportSite();
  } catch (err) {
    console.error('[export] FAILED:', err.message);
    process.exit(1);
  }
}
