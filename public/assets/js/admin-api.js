// assets/js/admin-api.js
// ---------------------------------------------------------------
// Shared by every admin page (dashboard, projects, categories,
// settings, etc.). Wraps fetch() with:
//   - automatic CSRF header on state-changing requests
//   - automatic redirect to /admin/login on a 401 response
//   - a consistent { success, ...data } JSON contract
// ---------------------------------------------------------------
'use strict';

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function redirectToLogin() {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/admin/login?next=${next}`;
}

const adminApi = {
  async _request(path, { method = 'GET', body, isFormData = false } = {}) {
    const headers = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    if (method !== 'GET') {
      const csrf = getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }

    const res = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });

    if (res.status === 401) {
      redirectToLogin();
      // Throw so calling code's awaiting promise doesn't continue
      throw new Error('Not authenticated');
    }

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

  get(path)            { return this._request(path, { method: 'GET' }); },
  post(path, body)     { return this._request(path, { method: 'POST', body }); },
  put(path, body)      { return this._request(path, { method: 'PUT', body }); },
  delete(path)         { return this._request(path, { method: 'DELETE' }); },
  postForm(path, form) { return this._request(path, { method: 'POST', body: form, isFormData: true }); },

  // ── Auth ─────────────────────────────────────────────────────
  login(email, password) {
    // Login itself doesn't have a CSRF cookie yet (it's what *creates* one),
    // so it bypasses the CSRF header — the rate limiter + password check
    // protect this endpoint instead.
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({ success: false, message: 'Unexpected server response.' }));
      if (!res.ok) throw new Error(data.message || 'Login failed.');
      return data;
    });
  },

  async me() {
    return this.get('/api/auth/me');
  },

  async logout() {
    return fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  },

  // ── Dashboard ────────────────────────────────────────────────
  getDashboard() { return this.get('/api/admin/dashboard'); },
};

window.adminApi = adminApi;
