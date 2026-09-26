// utils/seo.js
// ---------------------------------------------------------------
// SEO utilities:
//   generateSitemap(db, siteUrl)   → XML string
//   projectJsonLd(project, siteUrl) → JSON-LD object for detail pages
// ---------------------------------------------------------------
'use strict';

function xmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generate a full sitemap.xml string from live DB data.
 * Called by the GET /sitemap.xml route.
 */
function generateSitemap(db, siteUrl) {
  const base = siteUrl.replace(/\/$/, '');

  // Static pages
  const staticPages = [
    { url: '/',         changefreq: 'weekly',  priority: '1.0' },
    { url: '/projects', changefreq: 'weekly',  priority: '0.9' },
  ];

  // All published projects
  const projects = db.prepare(`
    SELECT slug, published_at, updated_at
    FROM projects
    WHERE status = 'published'
    ORDER BY published_at DESC
  `).all();

  const now = new Date().toISOString().split('T')[0];

  const urls = [
    ...staticPages.map(({ url, changefreq, priority }) => `
  <url>
    <loc>${xmlEscape(base + url)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <lastmod>${now}</lastmod>
  </url>`),
    ...projects.map((p) => {
      const lastmod = (p.updated_at || p.published_at || now).split('T')[0];
      return `
  <url>
    <loc>${xmlEscape(`${base}/project/${p.slug}`)}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <lastmod>${xmlEscape(lastmod)}</lastmod>
  </url>`;
    }),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

/**
 * Build a JSON-LD structured data object for a project detail page.
 * Injected as <script type="application/ld+json"> in the page head
 * via the project.js frontend script (sets document head dynamically).
 */
function projectJsonLd(project, siteUrl) {
  const base = siteUrl.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: project.title,
    description: project.short_description,
    url: `${base}/project/${project.slug}`,
    applicationCategory: 'ArtificialIntelligence',
    ...(project.thumbnail_path ? { image: `${base}${project.thumbnail_path}` } : {}),
    ...(project.github_url ? { codeRepository: project.github_url } : {}),
    ...(project.demo_url ? { installUrl: project.demo_url } : {}),
    ...(project.published_at ? { datePublished: project.published_at.split('T')[0] } : {}),
    ...(project.technologies?.length ? {
      applicationSubCategory: project.technologies.map(t => t.name).join(', ')
    } : {}),
  };
}

/**
 * Build the Open Graph + Twitter meta tag HTML for a project page.
 * Returned as a string to be injected into <head>.
 */
function projectMetaTags(project, siteUrl) {
  const base = siteUrl.replace(/\/$/, '');
  const url   = `${base}/project/${xmlEscape(project.slug)}`;
  const title = xmlEscape(`${project.title} | Kanishk`);
  const desc  = xmlEscape(project.short_description || '');
  const img   = project.thumbnail_path
    ? xmlEscape(`${base}${project.thumbnail_path}`)
    : xmlEscape(`${base}/assets/img/og-default.png`);

  return `
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${img}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${img}">
  <link rel="canonical" href="${url}">`;
}

module.exports = { generateSitemap, projectJsonLd, projectMetaTags };
