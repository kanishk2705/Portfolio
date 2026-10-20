// server.js
// ---------------------------------------------------------------
// Entry point for the AI/ML Portfolio Platform backend.
// Start with: npm start  (or  npm run dev  in development)
// ---------------------------------------------------------------
'use strict';

// Must be first — loads .env and validates required vars
const env = require('./config/env');

const path        = require('path');
const express     = require('express');
const helmet      = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const { generateSitemap } = require('./utils/seo');
const { siteContext }     = require('./utils/render');
const { homePage, projectsPage, projectPage } = require('./utils/pages');
const { UPLOAD_ROOT, resolveUploadPath } = require('./utils/uploads');
const { getDb }           = require('./config/db');
const { errorHandler }    = require('./middleware/errorHandler');
const { apiLimiter }      = require('./middleware/rateLimit');
const { requireAuth }     = require('./middleware/auth');

// Route modules
const publicRoutes   = require('./routes/public.routes');
const authRoutes     = require('./routes/auth.routes');
const adminRoutes    = require('./routes/admin.routes');
const projectsRoutes = require('./routes/projects.routes');
const uploadRoutes   = require('./routes/upload.routes');

// ── App ────────────────────────────────────────────────────────

const app = express();

// ── Security headers (Helmet) ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
      styleSrc:       ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdn.jsdelivr.net'],
      fontSrc:        ["'self'", 'fonts.gstatic.com', 'fonts.googleapis.com', 'cdn.jsdelivr.net'],
      imgSrc:         ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc:       ["'self'", 'blob:'],
      connectSrc:     ["'self'"],
      frameSrc:       ["'self'", 'www.youtube.com', 'player.vimeo.com'],
      objectSrc:      ["'none'"],
      upgradeInsecureRequests: env.IS_PRODUCTION ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // needed for embedded media
}));

// ── General middleware ─────────────────────────────────────────
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Trust proxy on Render (needed for rate limiter to see real IPs)
if (env.IS_PRODUCTION) app.set('trust proxy', 1);

// ── Static files ───────────────────────────────────────────────
// Uploaded media — served under /uploads/* from UPLOADS_PATH
app.use('/uploads', express.static(UPLOAD_ROOT, {
  maxAge: '7d',
  etag:   true,
  setHeaders(res, filePath) {
    // An SVG opened directly is a document that could run script; lock it down
    if (filePath.toLowerCase().endsWith('.svg')) {
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    }
  },
}));

// Public frontend assets
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: env.IS_PRODUCTION ? '1d' : 0,
  etag:   true,
  index:  false,  // we handle / ourselves so 404 logic is cleaner
}));

// ── API routes ─────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api',              publicRoutes);
app.use('/api/auth',         authRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/admin/projects', projectsRoutes);
app.use('/api/admin/upload', uploadRoutes);

// ── Page routes ────────────────────────────────────────────────
// Public pages are templates in views/, filled with live settings and
// SEO tags on every request (see utils/pages.js — shared with the static export).
const PUBLIC_DIR = path.join(__dirname, 'public');
const SITE_URL   = env.SITE_URL || `http://localhost:${env.PORT}`;

app.get('/', (req, res, next) => {
  try { res.send(homePage(SITE_URL)); } catch (err) { next(err); }
});

app.get('/projects', (req, res, next) => {
  try { res.send(projectsPage(SITE_URL)); } catch (err) { next(err); }
});

app.get('/project/:slug', (req, res, next) => {
  try {
    const { status, html } = projectPage(req.params.slug, SITE_URL);
    res.status(status).send(html);
  } catch (err) { next(err); }
});

// The uploaded CV at a stable address that never changes when you upload a new version
app.get('/cv.pdf', (req, res, next) => {
  try {
    const ctx  = siteContext();
    const file = resolveUploadPath(ctx['cv.file']);
    if (!file) return next();  // → 404
    res.set('Cache-Control', 'no-cache');  // always check for a newer CV
    res.set('Content-Disposition', `inline; filename="${ctx['site.name'].replace(/[^\w-]+/g, '-')}-CV.pdf"`);
    res.sendFile(file, (err) => { if (err && !res.headersSent) next(); });
  } catch (err) { next(err); }
});

// Admin pages — the HTML is served but all data is API-gated
function servePage(filename) {
  return (req, res) => res.sendFile(path.join(PUBLIC_DIR, filename));
}
app.get('/admin/login',     servePage('admin-login.html'));
app.get('/admin/dashboard', requireAuth, servePage('admin-dashboard.html'));
app.get('/admin',           (req, res) => res.redirect('/admin/dashboard'));

// SEO helpers
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${SITE_URL}/sitemap.xml`
  );
});

app.get('/sitemap.xml', (req, res) => {
  try {
    const xml = generateSitemap(getDb(), SITE_URL);
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');  // cache 1 hour
    res.send(xml);
  } catch (err) {
    console.error('[sitemap] error:', err.message);
    res.status(500).send('<?xml version="1.0"?><error>Could not generate sitemap.</error>');
  }
});

// ── 404 ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// ── Centralised error handler ──────────────────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`\n🚀  Portfolio running on http://localhost:${env.PORT}`);
  console.log(`   Environment : ${env.NODE_ENV}`);
  console.log(`   Database    : ${env.DATABASE_PATH}`);
  console.log(`   Admin login : ${SITE_URL}/admin/login\n`);
});

module.exports = app;
