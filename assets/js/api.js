// assets/js/api.js
// ---------------------------------------------------------------
// Data access for the public pages. Works in two modes, chosen by
// <meta name="site-mode"> (see views/partials/head.html):
//
//   server — calls the Express API (/api/...) while running locally
//   static — reads the JSON files written by `npm run export`
//            (<base>/api/*.json) and filters/paginates in the browser,
//            mirroring the server's behaviour, for GitHub Pages
//
// Admin scripts use admin-api.js instead.
// ---------------------------------------------------------------
'use strict';

(function () {
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content || '';
  const BASE   = meta('site-base');
  const STATIC = meta('site-mode') === 'static';

  async function fetchJson(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    let data;
    try {
      data = await res.json();
    } catch {
      data = { success: false, message: res.status === 404 ? 'Not found.' : 'Unexpected server response.' };
    }
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  }

  // ---- Static mode: one cached request per JSON file ----
  const cache = {};
  const staticFile = (name) => (cache[name] = cache[name] || fetchJson(`${BASE}/api/${name}.json`));

  // Same rules as Project.listPublished on the server
  async function staticProjects({ category, status, search, page = 1, limit = 12 } = {}) {
    const { projects: all } = await staticFile('projects');
    const q = (search || '').trim().toLowerCase();
    const matches = all.filter((p) =>
      (!category || category === 'all' || p.category_slug === category)
      && (!status || status === 'all' || p.project_status === status)
      && (!q || [p.title, p.short_description, ...(p.tags || []).map((t) => t.name), ...(p.technologies || []).map((t) => t.name)]
        .some((text) => (text || '').toLowerCase().includes(q))));

    const totalPages = Math.ceil(matches.length / limit);
    return {
      success: true,
      projects: matches.slice((page - 1) * limit, page * limit),
      pagination: { total: matches.length, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  }

  const api = {
    get(path) {
      return fetchJson(`${BASE}/api${path}`);
    },

    // ── Convenience methods used across pages ───────────────────

    async getFeaturedProjects(limit = 6) {
      if (!STATIC) return this.get(`/projects/featured?limit=${limit}`);
      const { projects } = await staticFile('projects');
      return { success: true, projects: projects.filter((p) => p.is_featured).slice(0, limit) };
    },

    getProjects({ category, status, search, page = 1, limit = 12 } = {}) {
      if (STATIC) return staticProjects({ category, status, search, page, limit });
      const params = new URLSearchParams();
      if (category && category !== 'all') params.set('category', category);
      if (status && status !== 'all') params.set('status', status);
      if (search) params.set('search', search);
      params.set('page', page);
      params.set('limit', limit);
      return this.get(`/projects?${params.toString()}`);
    },

    getProjectBySlug(slug) {
      return STATIC
        ? fetchJson(`${BASE}/api/projects/${encodeURIComponent(slug)}.json`)
        : this.get(`/projects/${encodeURIComponent(slug)}`);
    },

    getCategories()     { return STATIC ? staticFile('categories')   : this.get('/categories'); },
    getSkills()         { return STATIC ? staticFile('skills')       : this.get('/skills'); },
    getCertificates()   { return STATIC ? staticFile('certificates') : this.get('/certificates'); },
    getEducation()      { return STATIC ? staticFile('education')    : this.get('/education'); },
    getExperience()     { return STATIC ? staticFile('experience')   : this.get('/experience'); },
    getPublicSettings() { return STATIC ? staticFile('settings')     : this.get('/settings/public'); },
  };

  window.api = api;
})();
