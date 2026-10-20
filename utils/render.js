// utils/render.js
// ---------------------------------------------------------------
// Tiny server-side template renderer for the public pages in views/.
// Fills in site settings (hero copy, contact links, footer…) and the
// SEO <head> before the HTML leaves the server, so visitors and
// crawlers see the real content on first paint.
//
// Syntax:
//   {{> nav }}               include views/partials/nav.html
//   {{ key }}                escaped text, newlines become <br>
//   {{ key | attr }}         escaped, for use inside an attribute
//   {{ key | paras }}        blank-line-separated text → <p> paragraphs
//   {{ key | highlight }}    like {{ key }}, and *word* → gradient text
//   {{{ key }}}              raw HTML (only for values built in code)
//   {{#if key}}…{{/if}}      keep the block only when key has a value
//                            (blocks cannot be nested)
// ---------------------------------------------------------------
'use strict';

const path = require('path');
const fs   = require('fs');
const env  = require('../config/env');
const { getDb } = require('../config/db');

const VIEWS_DIR = path.join(__dirname, '..', 'views');
const cache = new Map();

function readView(relPath) {
  if (env.IS_PRODUCTION && cache.has(relPath)) return cache.get(relPath);
  const html = fs.readFileSync(path.join(VIEWS_DIR, relPath), 'utf8');
  if (env.IS_PRODUCTION) cache.set(relPath, html);
  return html;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const FILTERS = {
  text:      (v) => escapeHtml(v).replace(/\r?\n/g, '<br>'),
  attr:      (v) => escapeHtml(v),
  paras:     (v) => String(v ?? '').split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br>')}</p>`).join('\n'),
  highlight: (v) => FILTERS.text(v).replace(/\*([^*]+)\*/g, '<span class="text-gradient">$1</span>'),
};

/** All settings as a flat object, plus a few derived values every page uses. */
function siteContext() {
  const settings = {};
  for (const row of getDb().prepare('SELECT key, value FROM settings').all()) {
    settings[row.key] = row.value ?? '';
  }

  const db = getDb();
  const name = settings['site.name'] || 'Kanishk';
  const secondaryUrl = settings['hero.cta_secondary_url'] || '#contact';
  const isExternal = /^https?:\/\//.test(secondaryUrl);
  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  const jsonLength = (key) => { try { return JSON.parse(settings[key] || '[]').length; } catch { return 0; } };

  return {
    ...settings,
    'site.name':    name,
    'site.initial': name.charAt(0).toUpperCase(),
    'contact.mailto': settings['contact.email'] ? `mailto:${settings['contact.email']}` : '',
    'contact.headline': settings['contact.headline'] || "Let's build something intelligent",
    'contact.body':     settings['contact.body'] || '',
    'hero.cta_secondary_url':   secondaryUrl,
    'hero.cta_secondary_attrs': isExternal ? 'target="_blank" rel="noopener noreferrer"' : '',
    // An uploaded PDF is served at the stable /cv.pdf; otherwise fall back to an external link
    'cv.url':  settings['cv.file'] ? '/cv.pdf' : (settings['contact.resume_url'] || ''),
    'research.headline': settings['research.headline'] || 'Research Interests',
    // Section visibility flags for {{#if}} — empty sections are left out entirely
    'has.research':   jsonLength('research.items') || settings['research.intro'] ? '1' : '',
    'has.background': count('education') + count('experience') ? '1' : '',
    year: String(new Date().getFullYear()),
  };
}

function fill(html, ctx, depth = 0) {
  if (depth > 5) throw new Error('Template partials nested too deeply.');
  return html
    .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => fill(readView(`partials/${name}.html`), ctx, depth + 1))
    .replace(/\{\{#if\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, inner) => (ctx[key] ? inner : ''))
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, key) => ctx[key] ?? '')
    .replace(/\{\{\s*([\w.]+)\s*(?:\|\s*(\w+)\s*)?\}\}/g, (_, key, filter = 'text') => {
      const fn = FILTERS[filter];
      if (!fn) throw new Error(`Unknown template filter "${filter}".`);
      return fn(ctx[key]);
    });
}

/**
 * Render views/<file> with site settings plus page-specific values.
 * `extra` keys override settings (e.g. { 'seo.head': '<title>…' }).
 */
function renderPage(file, extra = {}) {
  return fill(readView(file), { ...siteContext(), ...extra });
}

module.exports = { renderPage, siteContext, escapeHtml };
