// assets/js/api.js
// ---------------------------------------------------------------
// Thin fetch wrapper for the public API. Admin scripts use their
// own wrapper (see admin-login.js) that also attaches CSRF headers.
// ---------------------------------------------------------------
'use strict';

const api = {
  async _request(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    let data;
    try {
      data = await res.json();
    } catch {
      data = { success: false, message: 'Unexpected server response.' };
    }
    if (!res.ok) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data;
  },

  get(path) {
    return this._request(path, { method: 'GET' });
  },

  // ── Convenience methods used across pages ───────────────────

  getFeaturedProjects(limit = 6) {
    return this.get(`/projects/featured?limit=${limit}`);
  },

  getProjects({ category, status, search, page = 1, limit = 12 } = {}) {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (status && status !== 'all') params.set('status', status);
    if (search) params.set('search', search);
    params.set('page', page);
    params.set('limit', limit);
    return this.get(`/projects?${params.toString()}`);
  },

  getProjectBySlug(slug) {
    return this.get(`/projects/${encodeURIComponent(slug)}`);
  },

  getCategories() {
    return this.get('/categories');
  },

  getSkills() {
    return this.get('/skills');
  },

  getCertificates() {
    return this.get('/certificates');
  },

  getEducation() {
    return this.get('/education');
  },

  getExperience() {
    return this.get('/experience');
  },

  getPublicSettings() {
    return this.get('/settings/public');
  },
};

window.api = api;
