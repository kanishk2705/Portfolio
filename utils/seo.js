// utils/seo.js
// ---------------------------------------------------------------
// SEO utilities:
//   generateSitemap(db, siteUrl)   → XML string
//   projectJsonLd(project, siteUrl) → JSON-LD object for detail pages
//   personJsonLd(ctx, siteUrl)      → JSON-LD object for the homepage
//   buildHead(opts, siteUrl)        → <title>/meta/OG/JSON-LD HTML for <head>
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
    { url: '/projects/', changefreq: 'weekly',  priority: '0.9' },
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
    <loc>${xmlEscape(`${base}/project/${p.slug}/`)}</loc>
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
 * Rendered into the page <head> by the /project/:slug route in server.js.
 */
function projectJsonLd(project, siteUrl) {
  const base = siteUrl.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: project.title,
    description: project.short_description,
    url: `${base}/project/${project.slug}/`,
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
 * JSON-LD describing the site owner, used on the homepage so search
 * engines can connect the site with your GitHub / LinkedIn profiles.
 */
function personJsonLd(ctx, siteUrl) {
  const sameAs = [ctx['contact.github'], ctx['contact.linkedin']].filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: ctx['site.name'],
    url: siteUrl.replace(/\/$/, '') + '/',
    ...(ctx['site.tagline'] ? { description: ctx['site.tagline'] } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/**
 * Build the <title>, description, canonical, Open Graph, Twitter and
 * JSON-LD tags for a page. Returned as an HTML string for <head>.
 *
 * @param {object} o
 * @param {string} o.title
 * @param {string} o.description
 * @param {string} o.path        site-relative path, e.g. "/projects"
 * @param {string} [o.image]     site-relative or absolute image URL
 * @param {string} [o.type]      og:type (website | article)
 * @param {object} [o.jsonLd]    structured data object
 * @param {boolean} [o.noindex]  keep the page out of search results
 * @param {string} [o.twitter]   @handle for twitter:site
 */
function buildHead({ title, description, path, image, type = 'website', jsonLd, noindex, twitter }, siteUrl) {
  const base = siteUrl.replace(/\/$/, '');
  const url  = base + path;
  const img  = image ? (/^https?:\/\//.test(image) ? image : base + image) : '';
  const esc  = xmlEscape;

  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="${esc(type)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    img && `<meta property="og:image" content="${esc(img)}">`,
    `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    img && `<meta name="twitter:image" content="${esc(img)}">`,
    twitter && `<meta name="twitter:site" content="${esc(twitter)}">`,
    // "<" is escaped so a value containing "</script>" can't end the tag early
    jsonLd && `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ];
  return tags.filter(Boolean).join('\n');
}

module.exports = { generateSitemap, projectJsonLd, personJsonLd, buildHead };
