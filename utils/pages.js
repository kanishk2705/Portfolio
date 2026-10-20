// utils/pages.js
// ---------------------------------------------------------------
// Builds the public pages (HTML + SEO head). Shared by the Express
// routes in server.js and the static exporter (scripts/export.js), so
// the live site and the GitHub Pages build are identical.
//
// Every function takes `siteUrl` (canonical origin + base path) and
// optional `extra` template values (the exporter passes site.base and
// site.mode).
// ---------------------------------------------------------------
'use strict';

const Project = require('../models/Project');
const { renderPage, siteContext } = require('./render');
const { buildHead, personJsonLd, projectJsonLd } = require('./seo');

function seoDefaults(ctx) {
  return {
    description: ctx['site.description'] || ctx['site.tagline'] || '',
    image:       ctx['og.image'] || '/assets/img/og-default.png',
    twitter:     ctx['twitter.handle'] || '',
  };
}

function homePage(siteUrl, extra = {}) {
  const ctx = siteContext();
  const head = buildHead({
    ...seoDefaults(ctx),
    title:  ctx['site.title'] || ctx['site.name'],
    path:   '/',
    jsonLd: personJsonLd(ctx, siteUrl),
  }, siteUrl);
  return renderPage('index.html', { ...extra, 'seo.head': head });
}

function projectsPage(siteUrl, extra = {}) {
  const ctx = siteContext();
  const head = buildHead({
    ...seoDefaults(ctx),
    title:       `Projects | ${ctx['site.name']}`,
    description: `AI, machine learning, data science and engineering projects by ${ctx['site.name']}.`,
    path:        '/projects/',
  }, siteUrl);
  return renderPage('projects.html', { ...extra, 'seo.head': head });
}

/**
 * Project detail page. The body is rendered in the browser by project.js;
 * the head carries the project's title, description, image and JSON-LD.
 * Returns { status, html } — 404 (with noindex) for unknown/unpublished slugs.
 */
function projectPage(slug, siteUrl, extra = {}) {
  const ctx = siteContext();
  const project = slug ? Project.findBySlug(slug) : null;
  const head = project
    ? buildHead({
      ...seoDefaults(ctx),
      title:       `${project.title} | ${ctx['site.name']}`,
      description: project.short_description || '',
      path:        `/project/${encodeURIComponent(project.slug)}/`,
      image:       project.thumbnail_path || project.banner_path || seoDefaults(ctx).image,
      type:        'article',
      jsonLd:      projectJsonLd(project, siteUrl),
    }, siteUrl)
    : buildHead({
      ...seoDefaults(ctx),
      title:   `Page not found | ${ctx['site.name']}`,
      path:    slug ? `/project/${encodeURIComponent(slug)}/` : '/404',
      noindex: true,
    }, siteUrl);
  return { status: project ? 200 : 404, html: renderPage('project.html', { ...extra, 'seo.head': head }) };
}

module.exports = { homePage, projectsPage, projectPage };
