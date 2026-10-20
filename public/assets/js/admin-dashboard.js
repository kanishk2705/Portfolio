// assets/js/admin-dashboard.js
// ---------------------------------------------------------------
// Drives the entire admin dashboard SPA:
//  - Auth guard (redirects to /admin/login if not authenticated)
//  - Section routing (hash-based, no page reload)
//  - Dashboard stats + recent projects + category breakdown
//  - Projects table: list, search, publish/unpublish/delete
//  - New/Edit project drawer with all fields
//  - Categories management
//  - Certificates management
//  - Skills management (homepage skill cards)
//  - Journey editor (homepage timeline)
//  - Settings editor
//  - Toast notification system
//  - Sidebar mobile toggle
// ---------------------------------------------------------------
'use strict';

(function () {

  // ============================================================
  // UTILS
  // ============================================================

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ---- Toast ----
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function showToast(message, type = 'success') {
    clearTimeout(toastTimer);
    toastEl.className = `toast toast--${type} is-visible`;
    toastEl.innerHTML = type === 'success'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> ${esc(message)}`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${esc(message)}`;
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 3500);
  }
  window.showToast = showToast;  // used by uploader.js for upload errors

  // ---- Confirm dialog (tiny inline modal) ----
  function confirmAction(message, { title = 'Are you sure?', okLabel = 'Delete', danger = true } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'admin-modal';
      overlay.innerHTML = `
        <div class="card" style="max-width:380px;width:100%;padding:var(--space-8);">
          <h3 style="font-size:var(--text-lg);margin-bottom:var(--space-3);">${esc(title)}</h3>
          <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-6);">${esc(message)}</p>
          <div style="display:flex;gap:var(--space-3);justify-content:flex-end;">
            <button class="btn btn--secondary" id="confirm-cancel">Cancel</button>
            <button class="btn btn--primary" ${danger ? 'style="background:var(--danger);border:none;"' : ''} id="confirm-ok">${esc(okLabel)}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
      overlay.querySelector('#confirm-ok').onclick    = () => { overlay.remove(); resolve(true); };
    });
  }

  // ---- Repeatable rows editor (project timeline, homepage journey) ----
  // fields: [{ key, label, type: 'text'|'textarea'|'select', options, placeholder, wide }]
  // Returns { getItems() } — rows whose fields are all blank are dropped.
  function repeatableList(container, { fields, items = [], addLabel = '+ Add item', emptyText = 'Nothing added yet.' }) {
    const rows = items.map((item) => ({ ...item }));

    function fieldHtml(f, value, rowIdx) {
      const id = `rl-${f.key}-${rowIdx}-${Math.random().toString(36).slice(2, 7)}`;
      const common = `class="${f.type === 'textarea' ? 'form-textarea' : f.type === 'select' ? 'form-select' : 'form-input'}" id="${id}" data-field="${f.key}" data-row="${rowIdx}"`;
      let control;
      if (f.type === 'textarea') {
        control = `<textarea ${common} rows="2" placeholder="${esc(f.placeholder || '')}">${esc(value)}</textarea>`;
      } else if (f.type === 'select') {
        const opts = [...f.options];
        if (value && !opts.includes(value)) opts.push(value);  // keep custom values
        control = `<select ${common}>${opts.map((o) => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      } else {
        control = `<input ${common} value="${esc(value)}" placeholder="${esc(f.placeholder || '')}">`;
      }
      return `<div class="repeat-row__field ${f.wide ? 'repeat-row__field--wide' : ''}"><label class="form-label" for="${id}">${f.label}</label>${control}</div>`;
    }

    function render() {
      container.innerHTML = `
        <div class="repeat-list">
          ${rows.length ? rows.map((row, i) => `
            <div class="repeat-row">
              <div class="repeat-row__fields">${fields.map((f) => fieldHtml(f, row[f.key] ?? '', i)).join('')}</div>
              <div class="repeat-row__actions">
                <button type="button" class="btn btn--ghost btn--sm" data-move="-1" data-row="${i}" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="btn btn--ghost btn--sm" data-move="1" data-row="${i}" title="Move down" ${i === rows.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" class="btn btn--ghost btn--sm repeat-row__remove" data-remove="${i}" title="Remove">✕</button>
              </div>
            </div>
          `).join('') : `<p class="repeat-list__empty">${esc(emptyText)}</p>`}
          <button type="button" class="btn btn--secondary btn--sm repeat-list__add">${esc(addLabel)}</button>
        </div>`;

      container.querySelectorAll('[data-field]').forEach((el) => {
        el.addEventListener('input', () => { rows[+el.dataset.row][el.dataset.field] = el.value; });
      });
      container.querySelectorAll('[data-move]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = +btn.dataset.row, j = i + +btn.dataset.move;
          [rows[i], rows[j]] = [rows[j], rows[i]];
          render();
        });
      });
      container.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', () => { rows.splice(+btn.dataset.remove, 1); render(); });
      });
      container.querySelector('.repeat-list__add').addEventListener('click', () => {
        rows.push(Object.fromEntries(fields.map((f) => [f.key, f.type === 'select' ? f.options[0] : ''])));
        render();
        container.querySelectorAll('.repeat-row')[rows.length - 1]?.querySelector('input, textarea')?.focus();
      });
    }

    render();
    return {
      getItems() {
        return rows
          .map((row) => Object.fromEntries(fields.map((f) => [f.key, String(row[f.key] ?? '').trim()])))
          .filter((row) => fields.some((f) => f.type !== 'select' && row[f.key]));
      },
    };
  }

  // ---- Small modal shell shared by the skill / category / cert forms ----
  function openModal(innerHtml, { maxWidth = 440 } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal';
    overlay.innerHTML = `<div class="card admin-modal__card" style="max-width:${maxWidth}px;">${innerHtml}</div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    return overlay;
  }

  // ============================================================
  // AUTH GUARD
  // ============================================================
  let currentUser = null;

  async function guardAuth() {
    try {
      const { user } = await adminApi.me();
      currentUser = user;
      document.getElementById('user-name').textContent  = user.name;
      document.getElementById('user-email').textContent = user.email;
      document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();
    } catch {
      window.location.href = '/admin/login';
    }
  }

  // ============================================================
  // SECTION ROUTING (hash-based)
  // ============================================================
  const SECTIONS = ['dashboard', 'projects', 'categories', 'certificates', 'skills', 'research', 'education', 'experience', 'journey', 'settings'];
  const sectionLoaders = {};  // registered below per section

  function getActiveSection() {
    const hash = window.location.hash.replace('#', '');
    return SECTIONS.includes(hash) ? hash : 'dashboard';
  }

  function activateSection(name) {
    SECTIONS.forEach((s) => {
      const el = document.getElementById(`section-${s}`);
      if (el) el.style.display = s === name ? 'block' : 'none';
    });

    document.querySelectorAll('.admin-nav__link').forEach((link) => {
      const target = link.dataset.section || (link.getAttribute('href') || '').replace('#', '');
      link.classList.toggle('is-active', target === name);
    });

    const titles = { dashboard: 'Dashboard', projects: 'Projects', categories: 'Categories', certificates: 'Certifications', skills: 'Skills', research: 'Research Interests', education: 'Education', experience: 'Experience', journey: 'Journey', settings: 'Site Settings' };
    document.getElementById('topbar-title').textContent = titles[name] || 'Dashboard';

    if (sectionLoaders[name]) sectionLoaders[name]();

    // Close mobile sidebar
    document.getElementById('admin-sidebar').classList.remove('is-open');
    document.getElementById('sidebar-overlay').classList.remove('is-visible');
  }

  function navigate(section) {
    window.location.hash = section;
  }

  window.addEventListener('hashchange', () => activateSection(getActiveSection()));

  // Nav link clicks
  document.querySelectorAll('[data-section]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.section);
    });
  });

  // ============================================================
  // MOBILE SIDEBAR
  // ============================================================
  const sidebarToggle  = document.getElementById('sidebar-toggle');
  const adminSidebar   = document.getElementById('admin-sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  sidebarToggle.addEventListener('click', () => {
    adminSidebar.classList.toggle('is-open');
    sidebarOverlay.classList.toggle('is-visible');
  });
  sidebarOverlay.addEventListener('click', () => {
    adminSidebar.classList.remove('is-open');
    sidebarOverlay.classList.remove('is-visible');
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await adminApi.logout();
    window.location.href = '/admin/login';
  });

  // ============================================================
  // SECTION: DASHBOARD
  // ============================================================
  sectionLoaders.dashboard = async function loadDashboard() {
    try {
      const { dashboard } = await adminApi.getDashboard();
      const { projects, categories } = dashboard;

      // Stat cards
      const statsEl = document.getElementById('dash-stats');
      statsEl.innerHTML = [
        { icon: '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>', label: 'Total Projects', value: projects.total },
        { icon: '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>', label: 'Published', value: projects.published },
        { icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', label: 'Drafts', value: projects.drafts },
        { icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', label: 'Featured', value: projects.featured },
      ].map(({ icon, label, value }) => `
        <div class="card dash-stat-card">
          <div class="dash-stat-card__top">
            <div class="dash-stat-card__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
            </div>
          </div>
          <div class="dash-stat-card__value">${value}</div>
          <div class="dash-stat-card__label">${label}</div>
        </div>
      `).join('');

      // Update projects badge in sidebar
      document.getElementById('badge-total').textContent = projects.total;

      // Recent projects list
      const recentEl = document.getElementById('recent-projects');
      if (!projects.recent.length) {
        recentEl.innerHTML = `<div class="empty-state" style="padding: var(--space-8) 0;"><p>No projects yet. <button class="btn btn--ghost btn--sm" id="quick-add">Add your first →</button></p></div>`;
        document.getElementById('quick-add')?.addEventListener('click', openProjectDrawer);
      } else {
        recentEl.innerHTML = projects.recent.map((p) => `
          <div class="recent-item">
            <div class="recent-item__thumb">
              ${p.thumbnail_path
                ? `<img src="${esc(p.thumbnail_path)}" alt="${esc(p.title)}">`
                : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg>`}
            </div>
            <div class="recent-item__info">
              <div class="recent-item__title">${esc(p.title)}</div>
              <div class="recent-item__meta">${esc(p.category || 'Uncategorised')} · ${fmtDate(p.updated_at)}</div>
            </div>
            <span class="status-pill status-pill--${p.status}">${p.status}</span>
          </div>
        `).join('');
      }

      // Category breakdown
      const breakdownEl = document.getElementById('category-breakdown');
      const withCount = categories.filter((c) => c.count > 0);
      if (!withCount.length) {
        breakdownEl.innerHTML = `<p style="color:var(--text-tertiary);font-size:var(--text-sm);">No published projects yet.</p>`;
      } else {
        const max = Math.max(...withCount.map((c) => c.count));
        breakdownEl.innerHTML = withCount.map((c) => `
          <div class="category-bar">
            <div class="category-bar__top">
              <span class="category-bar__name">${esc(c.name)}</span>
              <span class="category-bar__count">${c.count}</span>
            </div>
            <div class="category-bar__track">
              <div class="category-bar__fill" style="width:${Math.round((c.count / max) * 100)}%"></div>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      showToast(`Failed to load dashboard: ${err.message}`, 'error');
    }
  };

  // ============================================================
  // SECTION: PROJECTS TABLE
  // ============================================================
  let projectsState = { page: 1, search: '' };

  sectionLoaders.projects = function loadProjectsSection() {
    const panel = document.getElementById('projects-panel-content');
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6);">
        <div>
          <h2 style="font-size:var(--text-2xl);margin-bottom:var(--space-1);">Projects</h2>
          <p style="color:var(--text-secondary);font-size:var(--text-sm);">Add, edit, publish and manage all your projects.</p>
        </div>
        <button class="btn btn--primary" id="proj-new-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Project
        </button>
      </div>

      <div class="card" style="overflow:hidden;">
        <!-- Search bar -->
        <div style="padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--border);display:flex;gap:var(--space-3);">
          <div class="admin-search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="proj-search" placeholder="Search projects…">
          </div>
        </div>

        <!-- Table -->
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;" id="projects-table">
            <thead>
              <tr style="border-bottom:1px solid var(--border);text-align:left;">
                <th style="padding:var(--space-3) var(--space-5);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);font-weight:600;">Project</th>
                <th style="padding:var(--space-3) var(--space-4);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);font-weight:600);">Category</th>
                <th style="padding:var(--space-3) var(--space-4);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);font-weight:600;">Status</th>
                <th style="padding:var(--space-3) var(--space-4);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);font-weight:600;">Updated</th>
                <th style="padding:var(--space-3) var(--space-5);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);font-weight:600;text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody id="projects-tbody">
              <tr><td colspan="5" style="padding:var(--space-8);text-align:center;"><div class="skeleton" style="height:40px;"></div></td></tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div id="proj-pagination" style="padding:var(--space-4) var(--space-5);border-top:1px solid var(--border);display:none;"></div>
      </div>
    `;

    document.getElementById('proj-new-btn').addEventListener('click', () => openProjectDrawer());

    let searchTimer;
    document.getElementById('proj-search').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        projectsState.search = e.target.value.trim();
        projectsState.page = 1;
        fetchProjects();
      }, 300);
    });

    fetchProjects();
  };

  async function fetchProjects() {
    const tbody = document.getElementById('projects-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="padding:var(--space-8);text-align:center;color:var(--text-tertiary);">Loading…</td></tr>`;

    try {
      const params = new URLSearchParams({ page: projectsState.page, limit: 15 });
      if (projectsState.search) params.set('search', projectsState.search);
      const { projects, pagination } = await adminApi.get(`/api/admin/projects?${params}`);

      if (!projects.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:var(--space-10);text-align:center;color:var(--text-tertiary);">${projectsState.search ? `No projects match "${esc(projectsState.search)}"` : 'No projects yet. Click <strong>New Project</strong> to add one.'}</td></tr>`;
        document.getElementById('proj-pagination').style.display = 'none';
        return;
      }

      tbody.innerHTML = projects.map((p) => `
        <tr style="border-bottom:1px solid var(--border-subtle);transition:background var(--duration-fast) var(--ease-out);"
            onmouseover="this.style.background='var(--bg-subtle)'" onmouseout="this.style.background=''">
          <td style="padding:var(--space-4) var(--space-5);">
            <div style="display:flex;align-items:center;gap:var(--space-3);">
              <div style="width:40px;height:40px;border-radius:var(--radius-sm);background:var(--gradient-primary);flex-shrink:0;overflow:hidden;">
                ${p.thumbnail_path ? `<img src="${esc(p.thumbnail_path)}" style="width:100%;height:100%;object-fit:cover;">` : ''}
              </div>
              <div>
                <div style="font-weight:600;font-size:var(--text-sm);">${esc(p.title)}</div>
                <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary);">/project/${esc(p.slug)}</div>
              </div>
            </div>
          </td>
          <td style="padding:var(--space-4);"><span class="badge">${esc(p.category || '—')}</span></td>
          <td style="padding:var(--space-4);"><span class="status-pill status-pill--${p.status}">${p.status}</span></td>
          <td style="padding:var(--space-4);font-size:var(--text-sm);color:var(--text-secondary);">${fmtDate(p.updated_at)}</td>
          <td style="padding:var(--space-4) var(--space-5);text-align:right;">
            <div style="display:flex;gap:var(--space-2);justify-content:flex-end;">
              <a href="/project/${esc(p.slug)}" target="_blank" class="btn btn--ghost btn--sm" title="Preview">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </a>
              <button class="btn btn--ghost btn--sm proj-edit-btn" data-id="${p.id}" title="Edit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn--ghost btn--sm proj-toggle-btn" data-id="${p.id}" data-status="${p.status}" title="${p.status === 'published' ? 'Unpublish' : 'Publish'}">
                ${p.status === 'published'
                  ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
                  : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'}
              </button>
              <button class="btn btn--ghost btn--sm proj-delete-btn" data-id="${p.id}" data-title="${esc(p.title)}" title="Delete" style="color:var(--danger);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4h4v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      // Wire action buttons
      tbody.querySelectorAll('.proj-edit-btn').forEach((btn) => {
        btn.addEventListener('click', () => openProjectDrawer(parseInt(btn.dataset.id)));
      });
      tbody.querySelectorAll('.proj-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', () => toggleProjectStatus(parseInt(btn.dataset.id), btn.dataset.status));
      });
      tbody.querySelectorAll('.proj-delete-btn').forEach((btn) => {
        btn.addEventListener('click', () => deleteProject(parseInt(btn.dataset.id), btn.dataset.title));
      });

      // Pagination
      renderTablePagination('proj-pagination', pagination, (p) => {
        projectsState.page = p;
        fetchProjects();
      });

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:var(--space-8);text-align:center;color:var(--danger);">Failed to load projects: ${esc(err.message)}</td></tr>`;
    }
  }

  async function toggleProjectStatus(id, currentStatus) {
    try {
      const endpoint = currentStatus === 'published'
        ? `/api/admin/projects/${id}/unpublish`
        : `/api/admin/projects/${id}/publish`;
      await adminApi.post(endpoint, {});
      showToast(currentStatus === 'published' ? 'Project moved to draft.' : 'Project published!');
      fetchProjects();
      if (getActiveSection() === 'dashboard') sectionLoaders.dashboard();
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    }
  }

  async function deleteProject(id, title) {
    const confirmed = await confirmAction(`Delete "${title}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await adminApi.delete(`/api/admin/projects/${id}`);
      showToast('Project deleted.');
      fetchProjects();
      if (getActiveSection() === 'dashboard') sectionLoaders.dashboard();
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    }
  }

  function renderTablePagination(containerId, pagination, onPage) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (pagination.totalPages <= 1) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.style.gap = 'var(--space-2)';
    el.style.alignItems = 'center';

    const { page, totalPages } = pagination;
    let html = `<span style="font-size:var(--text-sm);color:var(--text-secondary);margin-right:auto;">${pagination.total} total</span>`;
    html += `<button class="pagination__btn" ${page === 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>`;
    for (let p = 1; p <= totalPages; p++) {
      html += `<button class="pagination__btn ${p === page ? 'is-active' : ''}" data-page="${p}">${p}</button>`;
    }
    html += `<button class="pagination__btn" ${page === totalPages ? 'disabled' : ''} data-page="${page + 1}">›</button>`;
    el.innerHTML = html;
    el.querySelectorAll('.pagination__btn:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => onPage(parseInt(btn.dataset.page)));
    });
  }

  // ============================================================
  // PROJECT DRAWER (New / Edit) — tabbed: Content | Media
  // ============================================================
  const drawer        = document.getElementById('project-drawer');
  const drawerPanel   = document.getElementById('drawer-panel');
  const drawerTitle   = document.getElementById('drawer-title');
  const drawerForm    = document.getElementById('drawer-form');
  const drawerClose   = document.getElementById('drawer-close');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const saveDraftBtn  = document.getElementById('save-draft-btn');
  const publishBtn    = document.getElementById('publish-btn');

  let editingProjectId = null;
  let editingProject   = null;
  let allCategories    = [];
  let projectOptions   = [];

  // Active editor instances (destroyed on drawer close)
  let _editors   = {};
  let _uploaders = {};
  let _timeline  = null;

  async function openProjectDrawer(projectId = null) {
    editingProjectId = projectId;
    drawerTitle.textContent = projectId ? 'Edit Project' : 'New Project';

    // Destroy old editor/uploader instances
    Object.values(_editors).forEach(e => e?.destroy?.());
    Object.values(_uploaders).forEach(u => {}); // uploaders are DOM-bound, cleared by innerHTML reset
    _editors = {}; _uploaders = {};

    // Load categories (select) and other projects (related picker)
    try {
      const [{ categories }, { projects }] = await Promise.all([
        adminApi.get('/api/admin/categories'),
        adminApi.get('/api/admin/projects/options'),
      ]);
      allCategories = categories;
      projectOptions = projects.filter((p) => p.id !== projectId);
    } catch { allCategories = []; projectOptions = []; }

    let project = null;
    if (projectId) {
      try {
        const res = await adminApi.get(`/api/admin/projects/${projectId}`);
        project = res.project;
      } catch (err) { showToast(`Failed to load project: ${err.message}`, 'error'); return; }
    }
    editingProject = project;

    drawerForm.innerHTML = buildProjectForm(project);
    wireDrawerForm(project);

    drawer.style.display = 'block';
    requestAnimationFrame(() => {
      drawerPanel.style.transform = 'translateX(0)';
      drawerPanel.style.transition = 'transform var(--duration-base) var(--ease-out)';
    });
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    Object.values(_editors).forEach(e => e?.destroy?.());
    _editors = {}; _uploaders = {}; _timeline = null;
    drawer.style.display = 'none';
    document.body.style.overflow = '';
    editingProjectId = null;
    editingProject = null;
  }

  drawerClose.addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.style.display !== 'none') closeDrawer(); });

  // Write-up sections, in the order they appear on the project page
  const PROJECT_RICH_FIELDS = [
    { id: 'overview',               label: 'Overview',               placeholder: 'What the project is, in a few sentences…' },
    { id: 'my_role',                label: 'My Role',                placeholder: 'What you personally did — especially in team projects…' },
    { id: 'problem_statement',      label: 'Problem Statement',      placeholder: 'What problem does this solve, and why does it matter?' },
    { id: 'dataset_info',           label: 'Dataset Information',    placeholder: 'Source, size, features, preprocessing…' },
    { id: 'methodology',            label: 'Methodology',            placeholder: 'Your approach, models and why you chose them…' },
    { id: 'implementation_details', label: 'Implementation Details', placeholder: 'Architecture, libraries, key decisions…' },
    { id: 'results',                label: 'Results',                placeholder: 'What you found — with numbers where possible…' },
    { id: 'key_learnings',          label: 'What I Learned',         placeholder: 'Skills gained, mistakes made, what you would do differently…' },
    { id: 'future_improvements',    label: 'Future Improvements',    placeholder: 'What comes next?' },
  ];

  // ---- Import from GitHub: fill the open form from a repo (nothing is saved) ----
  async function importFromGithub() {
    const input = document.getElementById('pf-import-url');
    const btn   = document.getElementById('pf-import-btn');
    const notes = document.getElementById('pf-import-notes');
    const url   = input.value.trim();
    if (!url) { showToast('Paste a GitHub repository URL first.', 'error'); return; }

    const hasContent = document.getElementById('pf-short-desc').value.trim()
      || PROJECT_RICH_FIELDS.some(({ id }) => _editors[id]?.getHtml());
    if (hasContent && !await confirmAction(
      'Importing replaces the description, links, tech stack, tags and any write-up sections found in the README. Your other fields stay as they are.',
      { title: 'Replace with GitHub content?', okLabel: 'Import', danger: false },
    )) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      const { project: d, notes: importNotes } = await adminApi.post('/api/admin/projects/import/github', { url });
      const set = (id, value) => {
        const el = document.getElementById(id);
        if (el && value != null && value !== '') { el.value = value; el.dispatchEvent(new Event('input')); }
      };

      set('pf-title', d.title);
      set('pf-short-desc', d.short_description);
      set('pf-github', d.github_url);
      set('pf-demo', d.demo_url);
      if (d.technologies?.length) set('pf-tech', d.technologies.join(', '));
      if (d.tags?.length) set('pf-tags', d.tags.join(', '));
      if (!document.getElementById('pf-started').value) set('pf-started', d.started_on);
      if (document.getElementById('pf-status').value === 'completed' && !document.getElementById('pf-completed').value) {
        set('pf-completed', d.last_activity_on);
      }
      PROJECT_RICH_FIELDS.forEach(({ id }) => { if (d[id]) _editors[id]?.setHtml(d[id]); });
      if (d.thumbnail_path && !_uploaders.thumbnail?.getPath()) _uploaders.thumbnail?.setPath(d.thumbnail_path);

      const filled = PROJECT_RICH_FIELDS.filter(({ id }) => d[id]).map(({ label }) => label);
      const allNotes = [
        filled.length ? `Filled: ${filled.join(', ')}.` : 'No write-up sections were found in the README.',
        ...importNotes,
        'Check every field before saving — especially the description, status and dates.',
      ];
      notes.innerHTML = allNotes.map((n) => `<li>${esc(n)}</li>`).join('');
      notes.hidden = false;
      showToast('Imported from GitHub. Review, then save.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Import';
    }
  }

  // ---- Build drawer HTML (tabs + both panels) ----
  function buildProjectForm(p) {
    const catOptions = allCategories.map((c) =>
      `<option value="${c.id}" ${p?.category_id == c.id ? 'selected' : ''}>${esc(c.name)}</option>`
    ).join('');

    const techValue = (p?.technologies || []).map((t) => t.name).join(', ');
    const tagValue  = (p?.tags || []).map((t) => t.name).join(', ');
    const metricsValue = (p?.metrics || []).map((m) => `${m.metric_label}: ${m.metric_value}`).join('\n');

    const status = p?.project_status || 'completed';

    return `
      <!-- Tab buttons -->
      <div class="drawer-tabs">
        <button class="drawer-tab is-active" data-tab="content">Content</button>
        <button class="drawer-tab" data-tab="media">Media & Files</button>
      </div>

      <!-- ══ CONTENT TAB ══ -->
      <div class="drawer-tab-panel is-active" data-panel="content">
        <div style="display:flex;flex-direction:column;gap:var(--space-5);">

          <!-- Import from GitHub -->
          <div class="import-panel">
            <label class="form-label" for="pf-import-url">Import from GitHub <span class="form-label__hint">(optional — fills the form from a public repo's README; nothing is saved until you click Save)</span></label>
            <div class="import-panel__row">
              <input class="form-input" id="pf-import-url" type="url" placeholder="https://github.com/username/repository" value="${esc(p?.github_url || '')}">
              <button type="button" class="btn btn--secondary" id="pf-import-btn">Import</button>
            </div>
            <ul class="import-panel__notes" id="pf-import-notes" hidden></ul>
          </div>

          <!-- Basic info -->
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);margin-bottom:var(--space-4);">Basic Info</div>

            <div class="form-group">
              <label class="form-label" for="pf-title">Title <span style="color:var(--danger)">*</span></label>
              <input class="form-input" id="pf-title" type="text" value="${esc(p?.title || '')}" placeholder="e.g. Real-Time Fraud Detection System">
            </div>

            <div class="form-group">
              <label class="form-label" for="pf-slug">Slug — auto-generated from title if blank</label>
              <input class="form-input" id="pf-slug" type="text" value="${esc(p?.slug || '')}" placeholder="e.g. fraud-detection-system">
            </div>

            <div class="form-group">
              <label class="form-label" for="pf-category">Category</label>
              <select class="form-select" id="pf-category">
                <option value="">— Select —</option>
                ${catOptions}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="pf-short-desc">Short Description <span style="color:var(--danger)">*</span></label>
              <textarea class="form-textarea" id="pf-short-desc" rows="2" placeholder="1–2 sentence summary shown on project cards.">${esc(p?.short_description || '')}</textarea>
            </div>
          </div>

          <!-- Project status -->
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);margin-bottom:var(--space-4);">Project Status</div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="pf-status">Status</label>
                <select class="form-select" id="pf-status">
                  <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
                  <option value="ongoing" ${status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
                  <option value="planned" ${status === 'planned' ? 'selected' : ''}>Planned</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="pf-started">Started <span class="form-label__hint">(month)</span></label>
                <input class="form-input" id="pf-started" type="month" value="${esc(p?.started_on || '')}">
              </div>
              <div class="form-group" id="pf-completed-group" ${status === 'completed' ? '' : 'hidden'}>
                <label class="form-label" for="pf-completed">Completed <span class="form-label__hint">(month)</span></label>
                <input class="form-input" id="pf-completed" type="month" value="${esc(p?.completed_on || '')}">
              </div>
            </div>
            <p class="form-hint">Shown as a badge on project cards ("Completed · Mar 2026", "Ongoing", "Planned"). Draft / Published (the buttons below) controls whether visitors can see the project at all.</p>
          </div>

          <!-- Rich text fields -->
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);margin-bottom:var(--space-4);">Project Write-up</div>
            <p class="form-hint">Every section is optional — empty ones are hidden on the project page.</p>
            ${PROJECT_RICH_FIELDS.map(({ id, label }) => `
              <div class="form-group">
                <label class="form-label">${label}</label>
                <div id="rte-wrap-${id}" class="rte-host"></div>
              </div>
            `).join('')}
          </div>

          <!-- Metrics -->
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);margin-bottom:var(--space-4);">Result Metrics</div>
            <div class="form-group">
              <label class="form-label" for="pf-metrics">One per line · format: Label: Value</label>
              <textarea class="form-textarea" id="pf-metrics" rows="3" placeholder="Accuracy: 94.2%&#10;F1 Score: 0.91&#10;Latency: 85ms">${esc(metricsValue)}</textarea>
            </div>
          </div>

          <!-- Links -->
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);margin-bottom:var(--space-4);">Links</div>
            <div class="form-group">
              <label class="form-label" for="pf-github">GitHub URL</label>
              <input class="form-input" id="pf-github" type="url" value="${esc(p?.github_url || '')}" placeholder="https://github.com/…">
            </div>
            <div class="form-group">
              <label class="form-label" for="pf-demo">Live Demo URL</label>
              <input class="form-input" id="pf-demo" type="url" value="${esc(p?.demo_url || '')}" placeholder="https://…">
            </div>
            <div class="form-group">
              <label class="form-label" for="pf-paper">Research Paper URL</label>
              <input class="form-input" id="pf-paper" type="url" value="${esc(p?.research_paper_url || '')}" placeholder="https://arxiv.org/…">
            </div>
          </div>

          <!-- Tech + tags -->
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);margin-bottom:var(--space-4);">Technologies & Tags</div>
            <div class="form-group">
              <label class="form-label" for="pf-tech">Technology Stack <span style="color:var(--text-tertiary);font-weight:400;">(comma-separated)</span></label>
              <input class="form-input" id="pf-tech" value="${esc(techValue)}" placeholder="Python, FastAPI, Docker">
            </div>
            <div class="form-group">
              <label class="form-label" for="pf-tags">Tags <span style="color:var(--text-tertiary);font-weight:400;">(comma-separated)</span></label>
              <input class="form-input" id="pf-tags" value="${esc(tagValue)}" placeholder="healthcare, nlp, production">
            </div>
          </div>

          <!-- Build timeline -->
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);margin-bottom:var(--space-2);">Build Timeline</div>
            <p class="form-hint">Milestones shown on the project page, e.g. "Week 1 — Data collection".</p>
            <div id="pf-timeline"></div>
          </div>

          <!-- Related projects -->
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);margin-bottom:var(--space-2);">Related Projects</div>
            <p class="form-hint">Pick up to 3 to show at the bottom of the project page. If none are picked, published projects from the same category are shown.</p>
            ${projectOptions.length ? `
              <div class="check-list" id="pf-related">
                ${projectOptions.map((o) => `
                  <label class="check-list__item">
                    <input type="checkbox" value="${o.id}" ${(p?.related_ids || []).includes(o.id) ? 'checked' : ''}>
                    <span>${esc(o.title)}</span>
                    ${o.status !== 'published' ? '<span class="status-pill status-pill--draft">draft</span>' : ''}
                  </label>
                `).join('')}
              </div>` : '<p class="repeat-list__empty">No other projects yet.</p>'}
          </div>

          <!-- Options -->
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);margin-bottom:var(--space-4);">Options</div>
            <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4);">
              <input type="checkbox" id="pf-featured" style="width:16px;height:16px;accent-color:var(--primary-to);" ${p?.is_featured ? 'checked' : ''}>
              <label for="pf-featured" style="font-size:var(--text-sm);font-weight:500;cursor:pointer;">Feature on homepage</label>
            </div>
            <div class="form-group">
              <label class="form-label" for="pf-order">Display Order <span style="color:var(--text-tertiary);font-weight:400;">(lower = first)</span></label>
              <input class="form-input" id="pf-order" type="number" value="${p?.display_order ?? 0}" min="0" style="width:100px;">
            </div>
          </div>

        </div>
      </div>

      <!-- ══ MEDIA TAB ══ -->
      <div class="drawer-tab-panel" data-panel="media">
        <div style="display:flex;flex-direction:column;gap:var(--space-2);">

          <div class="upload-section">
            <div class="upload-section__label">
              Thumbnail
              <span class="upload-section__hint">shown on project cards</span>
            </div>
            <div id="uz-host-thumbnail"></div>
          </div>

          <div class="upload-section">
            <div class="upload-section__label">
              Banner Image
              <span class="upload-section__hint">detail page header background</span>
            </div>
            <div id="uz-host-banner"></div>
          </div>

          <div class="upload-section">
            <div class="upload-section__label">
              Architecture Diagram
              <span class="upload-section__hint">single image, detail page</span>
            </div>
            <div id="uz-host-arch"></div>
          </div>

          <div class="upload-section">
            <div class="upload-section__label">
              Workflow Diagram
              <span class="upload-section__hint">single image, detail page</span>
            </div>
            <div id="uz-host-workflow"></div>
          </div>

          <div class="upload-section">
            <div class="upload-section__label">
              Gallery / Screenshots
              <span class="upload-section__hint">multiple images</span>
            </div>
            <div id="uz-host-gallery"></div>
          </div>

          <div class="upload-section">
            <div class="upload-section__label">
              Video Demo
              <span class="upload-section__hint">upload or paste YouTube / Vimeo URL</span>
            </div>
            <div id="uz-host-video"></div>
          </div>

          <div class="upload-section">
            <div class="upload-section__label">
              Documents / Reports
              <span class="upload-section__hint">PDF, Word</span>
            </div>
            <div id="uz-host-doc"></div>
          </div>

        </div>
      </div>
    `;
  }

  // ---- Wire tabs, editors, uploaders after innerHTML is set ----
  function wireDrawerForm(p) {
    // ── Tab switching ──
    drawerForm.querySelectorAll('.drawer-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        drawerForm.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('is-active'));
        drawerForm.querySelectorAll('.drawer-tab-panel').forEach(p => p.classList.remove('is-active'));
        tab.classList.add('is-active');
        drawerForm.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('is-active');
      });
    });

    // ── Auto slug from title ──
    const titleInput = document.getElementById('pf-title');
    const slugInput  = document.getElementById('pf-slug');
    titleInput.addEventListener('input', () => {
      if (!slugInput.value || slugInput.dataset.auto === 'true') {
        slugInput.value = titleInput.value.toLowerCase().trim()
          .replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
        slugInput.dataset.auto = 'true';
      }
    });
    slugInput.addEventListener('input', () => { slugInput.dataset.auto = 'false'; });

    // ── Rich text editors ──
    PROJECT_RICH_FIELDS.forEach(({ id, placeholder }) => {
      const host = document.getElementById(`rte-wrap-${id}`);
      if (!host) return;
      _editors[id] = Editor.create(host, { placeholder, initialHtml: p?.[id] || '' });
    });

    // ── Completion month only applies to completed projects ──
    const statusSelect = document.getElementById('pf-status');
    statusSelect.addEventListener('change', () => {
      document.getElementById('pf-completed-group').hidden = statusSelect.value !== 'completed';
    });

    // ── Import from GitHub ──
    document.getElementById('pf-import-btn').addEventListener('click', importFromGithub);
    document.getElementById('pf-import-url').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); importFromGithub(); }
    });

    // ── Build timeline ──
    _timeline = repeatableList(document.getElementById('pf-timeline'), {
      fields: [
        { key: 'date_label',  label: 'When',        placeholder: 'Week 1 / Mar 2026' },
        { key: 'title',       label: 'Milestone',   placeholder: 'Data collection & cleaning', wide: true },
        { key: 'description', label: 'Details',     type: 'textarea', placeholder: 'Optional', wide: true },
      ],
      items: (p?.timeline || []).map((e) => ({ date_label: e.date_label, title: e.title, description: e.description })),
      addLabel: '+ Add milestone',
      emptyText: 'No milestones yet.',
    });

    // ── Related projects: cap at 3 ──
    const relatedBoxes = drawerForm.querySelectorAll('#pf-related input[type="checkbox"]');
    relatedBoxes.forEach((box) => box.addEventListener('change', () => {
      if ([...relatedBoxes].filter((b) => b.checked).length > 3) {
        box.checked = false;
        showToast('Pick at most 3 related projects.', 'error');
      }
    }));

    // ── Upload zones ──
    _uploaders.thumbnail = Uploader.singleImage(
      document.getElementById('uz-host-thumbnail'),
      { type: 'thumbnail', initialPath: p?.thumbnail_path || null }
    );

    _uploaders.banner = Uploader.singleImage(
      document.getElementById('uz-host-banner'),
      { type: 'banner', initialPath: p?.banner_path || null }
    );

    _uploaders.arch = Uploader.singleImage(
      document.getElementById('uz-host-arch'),
      { type: 'architecture', hint: 'PNG, JPG, SVG · max 8 MB', initialPath: p?.architecture_diagram_path || null }
    );

    _uploaders.workflow = Uploader.singleImage(
      document.getElementById('uz-host-workflow'),
      { type: 'workflow', hint: 'PNG, JPG, SVG · max 8 MB', initialPath: p?.workflow_diagram_path || null }
    );

    _uploaders.gallery = Uploader.gallery(
      document.getElementById('uz-host-gallery'),
      { initialImages: p?.images || [] }
    );

    _uploaders.video = Uploader.video(
      document.getElementById('uz-host-video'),
      { initialVideos: p?.videos || [] }
    );

    _uploaders.doc = Uploader.document(
      document.getElementById('uz-host-doc'),
      { initialDocs: p?.documents || [] }
    );
  }

  // ---- Collect all form values including editor HTML and upload paths ----
  function collectDrawerPayload(status) {
    const getValue = (id) => document.getElementById(id)?.value?.trim() || null;

    const title = getValue('pf-title');
    if (!title)          { showToast('Title is required.', 'error'); return null; }
    const shortDesc = getValue('pf-short-desc');
    if (!shortDesc)      { showToast('Short description is required.', 'error'); return null; }

    // Rich text fields from editor instances
    const richFields = {};
    PROJECT_RICH_FIELDS.forEach(({ id }) => {
      richFields[id] = _editors[id] ? _editors[id].getHtml() : null;
    });

    const projectStatus = document.getElementById('pf-status').value;
    const startedOn   = getValue('pf-started');
    const completedOn = projectStatus === 'completed' ? getValue('pf-completed') : null;
    if (startedOn && completedOn && completedOn < startedOn) {
      showToast('The completion month is before the start month.', 'error');
      return null;
    }

    // Metrics (text → array)
    const metricsRaw = getValue('pf-metrics') || '';
    const metrics = metricsRaw.split('\n').map(l => l.trim()).filter(Boolean)
      .map(l => { const i = l.indexOf(':'); return i === -1 ? null : { label: l.slice(0,i).trim(), value: l.slice(i+1).trim() }; })
      .filter(Boolean);

    const parseCsv = (id) => (getValue(id)||'').split(',').map(s=>s.trim()).filter(Boolean);

    // Gallery keeps only paths; carry over alt text / captions of images that stay
    const oldImages = new Map((editingProject?.images || []).map((img) => [img.file_path, img]));
    const images = (_uploaders.gallery?.getPaths() || []).map((path) => ({
      file_path: path,
      alt_text:  oldImages.get(path)?.alt_text || null,
      caption:   oldImages.get(path)?.caption  || null,
    }));
    const videos = (_uploaders.video?.getVideos() || []).map((v) => ({
      source_type:  v.source_type,
      file_path:    v.file_path || null,
      external_url: v.external_url || null,
      title:        v.title || null,
    }));
    const documents = (_uploaders.doc?.getDocs() || []).map((d) => ({ file_path: d.file_path, label: d.label || null }));
    const relatedIds = [...drawerForm.querySelectorAll('#pf-related input:checked')].map((b) => parseInt(b.value, 10));

    return {
      title,
      slug:              getValue('pf-slug') || '',
      category_id:       parseInt(document.getElementById('pf-category')?.value)||null,
      short_description: shortDesc,
      ...richFields,

      // Upload paths from uploader instances
      thumbnail_path:          _uploaders.thumbnail?.getPath() || null,
      banner_path:             _uploaders.banner?.getPath()    || null,
      architecture_diagram_path: _uploaders.arch?.getPath()   || null,
      workflow_diagram_path:   _uploaders.workflow?.getPath()  || null,

      github_url:         getValue('pf-github'),
      demo_url:           getValue('pf-demo'),
      research_paper_url: getValue('pf-paper'),
      is_featured:        document.getElementById('pf-featured')?.checked ? 1 : 0,
      display_order:      parseInt(document.getElementById('pf-order')?.value)||0,
      status,
      project_status: projectStatus,
      started_on:     startedOn,
      completed_on:   completedOn,

      technologies: parseCsv('pf-tech'),
      tags:         parseCsv('pf-tags'),
      metrics,
      timeline:     _timeline ? _timeline.getItems() : [],
      images,
      videos,
      documents,
      related_ids:  relatedIds,
    };
  }

  async function saveProject(status) {
    const payload = collectDrawerPayload(status);
    if (!payload) return;

    saveDraftBtn.disabled = true;
    publishBtn.disabled   = true;
    publishBtn.innerHTML  = '<span class="spinner"></span>';

    try {
      if (editingProjectId) {
        await adminApi.put(`/api/admin/projects/${editingProjectId}`, payload);
        showToast('Project updated successfully!');
      } else {
        const { project } = await adminApi.post('/api/admin/projects', payload);
        showToast(`"${project.title}" ${status === 'published' ? 'published!' : 'saved as draft.'}`);
      }
      closeDrawer();
      if (getActiveSection() === 'projects') fetchProjects();
      if (getActiveSection() === 'dashboard') sectionLoaders.dashboard();
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      saveDraftBtn.disabled = false;
      publishBtn.disabled   = false;
      publishBtn.innerHTML  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Publish';
    }
  }

  saveDraftBtn.addEventListener('click',  () => saveProject('draft'));
  publishBtn.addEventListener('click',    () => saveProject('published'));
  document.getElementById('new-project-btn').addEventListener('click', () => openProjectDrawer());
  document.getElementById('qa-new-project').addEventListener('click',  () => openProjectDrawer());

  // ============================================================
  // SECTION: CATEGORIES
  // ============================================================
  sectionLoaders.categories = async function loadCategories() {
    const panel = document.getElementById('categories-panel-content');
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6);">
        <div>
          <h2 style="font-size:var(--text-2xl);margin-bottom:var(--space-1);">Categories</h2>
          <p style="color:var(--text-secondary);font-size:var(--text-sm);">Control which categories appear on the Projects page filter bar.</p>
        </div>
        <button class="btn btn--primary" id="cat-add-btn">+ Add Category</button>
      </div>
      <div class="card" id="cat-list" style="overflow:hidden;">
        <div class="skeleton" style="height:200px;"></div>
      </div>
    `;
    document.getElementById('cat-add-btn').addEventListener('click', () => showCategoryForm());
    await renderCategoryList();
  };

  async function renderCategoryList() {
    const el = document.getElementById('cat-list');
    if (!el) return;
    try {
      const { categories } = await adminApi.get('/api/admin/categories');
      if (!categories.length) {
        el.innerHTML = `<div class="empty-state"><h3>No categories</h3><p>Add categories to enable filtering on the Projects page.</p></div>`;
        return;
      }
      el.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:var(--space-3) var(--space-5);text-align:left;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);">Name</th>
              <th style="padding:var(--space-3) var(--space-4);text-align:left;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);">Slug</th>
              <th style="padding:var(--space-3) var(--space-4);text-align:left;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);">Order</th>
              <th style="padding:var(--space-3) var(--space-5);text-align:right;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${categories.map((c) => `
              <tr style="border-bottom:1px solid var(--border-subtle);">
                <td style="padding:var(--space-4) var(--space-5);font-weight:600;">${esc(c.name)}</td>
                <td style="padding:var(--space-4);font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-tertiary);">${esc(c.slug)}</td>
                <td style="padding:var(--space-4);color:var(--text-secondary);">${c.sort_order}</td>
                <td style="padding:var(--space-4) var(--space-5);text-align:right;">
                  <div style="display:flex;gap:var(--space-2);justify-content:flex-end;">
                    <button class="btn btn--ghost btn--sm cat-edit-btn" data-id="${c.id}" data-name="${esc(c.name)}" data-slug="${esc(c.slug)}" data-desc="${esc(c.description||'')}" data-order="${c.sort_order}">Edit</button>
                    <button class="btn btn--ghost btn--sm cat-del-btn" data-id="${c.id}" data-name="${esc(c.name)}" style="color:var(--danger);">Delete</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      el.querySelectorAll('.cat-edit-btn').forEach((btn) => {
        btn.addEventListener('click', () => showCategoryForm({ id: btn.dataset.id, name: btn.dataset.name, slug: btn.dataset.slug, description: btn.dataset.desc, sort_order: btn.dataset.order }));
      });
      el.querySelectorAll('.cat-del-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const ok = await confirmAction(`Delete category "${btn.dataset.name}"? Projects in this category will become uncategorised.`);
          if (!ok) return;
          try {
            await adminApi.delete(`/api/admin/categories/${btn.dataset.id}`);
            showToast('Category deleted.');
            renderCategoryList();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    } catch (err) {
      el.innerHTML = `<div class="empty-state"><h3>Failed to load categories</h3><p>${esc(err.message)}</p></div>`;
    }
  }

  function showCategoryForm(cat = null) {
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal';
    overlay.innerHTML = `
      <div class="card" style="max-width:440px;width:100%;padding:var(--space-8);">
        <h3 style="font-size:var(--text-xl);margin-bottom:var(--space-6);">${cat ? 'Edit Category' : 'New Category'}</h3>
        <div class="form-group"><label class="form-label">Name *</label><input class="form-input" id="cf-name" value="${esc(cat?.name||'')}"></div>
        <div class="form-group"><label class="form-label">Slug *</label><input class="form-input" id="cf-slug" value="${esc(cat?.slug||'')}"></div>
        <div class="form-group"><label class="form-label">Description</label><input class="form-input" id="cf-desc" value="${esc(cat?.description||'')}"></div>
        <div class="form-group"><label class="form-label">Display Order</label><input class="form-input" id="cf-order" type="number" value="${cat?.sort_order||0}" style="width:100px;"></div>
        <div style="display:flex;gap:var(--space-3);justify-content:flex-end;margin-top:var(--space-6);">
          <button class="btn btn--secondary" id="cf-cancel">Cancel</button>
          <button class="btn btn--primary" id="cf-save">${cat ? 'Save' : 'Create'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // auto-slug from name
    const nameEl = overlay.querySelector('#cf-name');
    const slugEl = overlay.querySelector('#cf-slug');
    nameEl.addEventListener('input', () => {
      if (!cat) slugEl.value = nameEl.value.toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,'-');
    });

    overlay.querySelector('#cf-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#cf-save').addEventListener('click', async () => {
      const payload = { name: overlay.querySelector('#cf-name').value.trim(), slug: overlay.querySelector('#cf-slug').value.trim(), description: overlay.querySelector('#cf-desc').value.trim(), sort_order: parseInt(overlay.querySelector('#cf-order').value)||0 };
      if (!payload.name || !payload.slug) { showToast('Name and slug are required.', 'error'); return; }
      try {
        if (cat) await adminApi.put(`/api/admin/categories/${cat.id}`, payload);
        else await adminApi.post('/api/admin/categories', payload);
        showToast(cat ? 'Category updated.' : 'Category created.');
        overlay.remove();
        renderCategoryList();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  // ============================================================
  // SECTION: CERTIFICATES
  // ============================================================
  sectionLoaders.certificates = async function loadCertificates() {
    const panel = document.getElementById('certificates-panel-content');
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6);">
        <div>
          <h2 style="font-size:var(--text-2xl);margin-bottom:var(--space-1);">Certifications</h2>
          <p style="color:var(--text-secondary);font-size:var(--text-sm);">Manage the certificate cards shown on your homepage.</p>
        </div>
        <button class="btn btn--primary" id="cert-add-btn">+ Add Certificate</button>
      </div>
      <div class="card" id="cert-list" style="overflow:hidden;">
        <div class="skeleton" style="height:200px;"></div>
      </div>
    `;
    document.getElementById('cert-add-btn').addEventListener('click', () => showCertForm());
    await renderCertList();
  };

  async function renderCertList() {
    const el = document.getElementById('cert-list');
    if (!el) return;
    try {
      const { certificates } = await adminApi.get('/api/admin/certificates');
      if (!certificates.length) {
        el.innerHTML = `<div class="empty-state"><h3>No certifications</h3><p>Add certificates to display them on your homepage.</p></div>`;
        return;
      }
      el.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:var(--space-3) var(--space-5);text-align:left;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);">Title</th>
              <th style="padding:var(--space-3) var(--space-4);text-align:left;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);">Issuer</th>
              <th style="padding:var(--space-3) var(--space-4);text-align:left;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);">Date</th>
              <th style="padding:var(--space-3) var(--space-5);text-align:right;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${certificates.map((c) => `
              <tr style="border-bottom:1px solid var(--border-subtle);">
                <td style="padding:var(--space-4) var(--space-5);font-weight:600;">${esc(c.title)}</td>
                <td style="padding:var(--space-4);color:var(--text-secondary);font-size:var(--text-sm);">${esc(c.issuer)}</td>
                <td style="padding:var(--space-4);font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-tertiary);">${esc(c.issue_date||'—')}</td>
                <td style="padding:var(--space-4) var(--space-5);text-align:right;">
                  <div style="display:flex;gap:var(--space-2);justify-content:flex-end;">
                    <button class="btn btn--ghost btn--sm cert-edit-btn" data-id="${c.id}" data-title="${esc(c.title)}" data-issuer="${esc(c.issuer)}" data-date="${esc(c.issue_date||'')}" data-url="${esc(c.credential_url||'')}" data-order="${c.sort_order}">Edit</button>
                    <button class="btn btn--ghost btn--sm cert-del-btn" data-id="${c.id}" data-title="${esc(c.title)}" style="color:var(--danger);">Delete</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      el.querySelectorAll('.cert-edit-btn').forEach((btn) => {
        btn.addEventListener('click', () => showCertForm({ id: btn.dataset.id, title: btn.dataset.title, issuer: btn.dataset.issuer, issue_date: btn.dataset.date, credential_url: btn.dataset.url, sort_order: btn.dataset.order }));
      });
      el.querySelectorAll('.cert-del-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const ok = await confirmAction(`Delete "${btn.dataset.title}"?`);
          if (!ok) return;
          try {
            await adminApi.delete(`/api/admin/certificates/${btn.dataset.id}`);
            showToast('Certificate deleted.');
            renderCertList();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    } catch (err) {
      el.innerHTML = `<div class="empty-state"><h3>Failed to load</h3><p>${esc(err.message)}</p></div>`;
    }
  }

  function showCertForm(cert = null) {
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal';
    overlay.innerHTML = `
      <div class="card" style="max-width:440px;width:100%;padding:var(--space-8);">
        <h3 style="font-size:var(--text-xl);margin-bottom:var(--space-6);">${cert ? 'Edit Certificate' : 'Add Certificate'}</h3>
        <div class="form-group"><label class="form-label">Title *</label><input class="form-input" id="certf-title" value="${esc(cert?.title||'')}"></div>
        <div class="form-group"><label class="form-label">Issuer *</label><input class="form-input" id="certf-issuer" value="${esc(cert?.issuer||'')}"></div>
        <div class="form-group"><label class="form-label">Date (e.g. "March 2025")</label><input class="form-input" id="certf-date" value="${esc(cert?.issue_date||'')}"></div>
        <div class="form-group"><label class="form-label">Credential URL</label><input class="form-input" id="certf-url" type="url" value="${esc(cert?.credential_url||'')}"></div>
        <div class="form-group"><label class="form-label">Display Order</label><input class="form-input" id="certf-order" type="number" value="${cert?.sort_order||0}" style="width:100px;"></div>
        <div style="display:flex;gap:var(--space-3);justify-content:flex-end;margin-top:var(--space-6);">
          <button class="btn btn--secondary" id="certf-cancel">Cancel</button>
          <button class="btn btn--primary" id="certf-save">${cert ? 'Save' : 'Add'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#certf-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#certf-save').addEventListener('click', async () => {
      const payload = { title: overlay.querySelector('#certf-title').value.trim(), issuer: overlay.querySelector('#certf-issuer').value.trim(), issue_date: overlay.querySelector('#certf-date').value.trim(), credential_url: overlay.querySelector('#certf-url').value.trim(), sort_order: parseInt(overlay.querySelector('#certf-order').value)||0 };
      if (!payload.title || !payload.issuer) { showToast('Title and issuer are required.', 'error'); return; }
      try {
        if (cert) await adminApi.put(`/api/admin/certificates/${cert.id}`, payload);
        else await adminApi.post('/api/admin/certificates', payload);
        showToast(cert ? 'Certificate updated.' : 'Certificate added.');
        overlay.remove();
        renderCertList();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  // ============================================================
  // SECTION: SKILLS (homepage skill cards)
  // ============================================================
  // Icon keys must match the ICONS map in home.js
  const SKILL_ICONS = [
    ['ml', 'Machine Learning'], ['dl', 'Deep Learning'], ['genai', 'Generative AI'],
    ['nlp', 'NLP / Chat'], ['ds', 'Data Science / Charts'], ['de', 'Data Engineering / Database'],
    ['mlops', 'MLOps / Settings'], ['python', 'Python / Code'], ['cloud', 'Cloud'],
  ];

  sectionLoaders.skills = async function loadSkills() {
    const panel = document.getElementById('skills-panel-content');
    panel.innerHTML = `
      <div class="admin-section-head">
        <div>
          <h2>Skills</h2>
          <p>The skill cards in the "Technical Skills" section of your homepage. Each card shows its skills as tags, in the order set here.</p>
        </div>
        <button class="btn btn--primary" id="skillcat-add-btn">+ Add Skill Card</button>
      </div>
      <div id="skill-list"><div class="skeleton" style="height:200px;border-radius:var(--radius-lg);"></div></div>
    `;
    document.getElementById('skillcat-add-btn').addEventListener('click', () => showSkillCategoryForm());
    await renderSkillList();
  };

  async function renderSkillList(skillCategories) {
    const el = document.getElementById('skill-list');
    if (!el) return;
    try {
      if (!skillCategories) ({ skillCategories } = await adminApi.get('/api/admin/skills'));
      if (!skillCategories.length) {
        el.innerHTML = `<div class="card empty-state"><h3>No skill cards</h3><p>Add a card such as "Machine Learning", then add skills to it.</p></div>`;
        return;
      }
      el.innerHTML = skillCategories.map((cat) => `
        <div class="card skill-admin-card">
          <div class="skill-admin-card__head">
            <div>
              <h3>${esc(cat.name)}</h3>
              <span class="skill-admin-card__meta">Order ${cat.sort_order} · ${cat.skills.length} skill${cat.skills.length === 1 ? '' : 's'}</span>
            </div>
            <div class="skill-admin-card__actions">
              <button class="btn btn--secondary btn--sm" data-add-skill="${cat.id}">+ Skill</button>
              <button class="btn btn--ghost btn--sm" data-edit-cat="${cat.id}">Edit</button>
              <button class="btn btn--ghost btn--sm" data-del-cat="${cat.id}" style="color:var(--danger);">Delete</button>
            </div>
          </div>
          ${cat.skills.length ? `
            <div class="skill-admin-list">
              ${cat.skills.map((s) => `
                <div class="skill-admin-row">
                  <span class="skill-admin-row__name">${esc(s.name)}</span>
                  <button class="btn btn--ghost btn--sm" data-edit-skill="${s.id}">Edit</button>
                  <button class="btn btn--ghost btn--sm" data-del-skill="${s.id}" style="color:var(--danger);">✕</button>
                </div>
              `).join('')}
            </div>` : '<p class="repeat-list__empty">No skills in this card yet.</p>'}
        </div>
      `).join('');

      const findCat   = (id) => skillCategories.find((c) => c.id === +id);
      const findSkill = (id) => skillCategories.flatMap((c) => c.skills).find((s) => s.id === +id);

      el.querySelectorAll('[data-add-skill]').forEach((b) => b.addEventListener('click', () =>
        showSkillForm(null, skillCategories, +b.dataset.addSkill)));
      el.querySelectorAll('[data-edit-cat]').forEach((b) => b.addEventListener('click', () =>
        showSkillCategoryForm(findCat(b.dataset.editCat))));
      el.querySelectorAll('[data-edit-skill]').forEach((b) => b.addEventListener('click', () =>
        showSkillForm(findSkill(b.dataset.editSkill), skillCategories)));
      el.querySelectorAll('[data-del-cat]').forEach((b) => b.addEventListener('click', async () => {
        const cat = findCat(b.dataset.delCat);
        if (!await confirmAction(`Delete the "${cat.name}" card and its ${cat.skills.length} skills?`)) return;
        try {
          const res = await adminApi.delete(`/api/admin/skill-categories/${cat.id}`);
          showToast('Skill card deleted.');
          renderSkillList(res.skillCategories);
        } catch (err) { showToast(err.message, 'error'); }
      }));
      el.querySelectorAll('[data-del-skill]').forEach((b) => b.addEventListener('click', async () => {
        const skill = findSkill(b.dataset.delSkill);
        if (!await confirmAction(`Delete "${skill.name}"?`)) return;
        try {
          const res = await adminApi.delete(`/api/admin/skills/${skill.id}`);
          showToast('Skill deleted.');
          renderSkillList(res.skillCategories);
        } catch (err) { showToast(err.message, 'error'); }
      }));
    } catch (err) {
      el.innerHTML = `<div class="card empty-state"><h3>Failed to load skills</h3><p>${esc(err.message)}</p></div>`;
    }
  }

  function showSkillCategoryForm(cat = null) {
    const overlay = openModal(`
      <h3 class="admin-modal__title">${cat ? 'Edit Skill Card' : 'New Skill Card'}</h3>
      <div class="form-group"><label class="form-label" for="scf-name">Name *</label><input class="form-input" id="scf-name" value="${esc(cat?.name || '')}" placeholder="e.g. Machine Learning"></div>
      <div class="form-group"><label class="form-label" for="scf-icon">Icon</label>
        <select class="form-select" id="scf-icon">
          ${SKILL_ICONS.map(([key, label]) => `<option value="${key}" ${cat?.icon === key ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label class="form-label" for="scf-order">Display Order <span class="form-label__hint">(lower = first)</span></label><input class="form-input" id="scf-order" type="number" min="0" value="${cat?.sort_order ?? 0}" style="width:100px;"></div>
      <div class="admin-modal__actions">
        <button class="btn btn--secondary" data-cancel>Cancel</button>
        <button class="btn btn--primary" data-save>${cat ? 'Save' : 'Create'}</button>
      </div>
    `);
    overlay.querySelector('[data-cancel]').addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-save]').addEventListener('click', async () => {
      const payload = {
        name:       overlay.querySelector('#scf-name').value.trim(),
        icon:       overlay.querySelector('#scf-icon').value,
        sort_order: parseInt(overlay.querySelector('#scf-order').value, 10) || 0,
      };
      if (!payload.name) { showToast('Name is required.', 'error'); return; }
      try {
        const res = cat
          ? await adminApi.put(`/api/admin/skill-categories/${cat.id}`, payload)
          : await adminApi.post('/api/admin/skill-categories', payload);
        showToast(cat ? 'Skill card updated.' : 'Skill card created.');
        overlay.remove();
        renderSkillList(res.skillCategories);
      } catch (err) { showToast(err.message, 'error'); }
    });
    overlay.querySelector('#scf-name').focus();
  }

  function showSkillForm(skill, skillCategories, categoryId = null) {
    const catId = skill?.skill_category_id ?? categoryId;
    const overlay = openModal(`
      <h3 class="admin-modal__title">${skill ? 'Edit Skill' : 'New Skill'}</h3>
      <div class="form-group"><label class="form-label" for="sf-name">Name *</label><input class="form-input" id="sf-name" value="${esc(skill?.name || '')}" placeholder="e.g. PyTorch"></div>
      <div class="form-group"><label class="form-label" for="sf-cat">Card</label>
        <select class="form-select" id="sf-cat">
          ${skillCategories.map((c) => `<option value="${c.id}" ${c.id === catId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label class="form-label" for="sf-order">Display Order <span class="form-label__hint">(lower = first)</span></label><input class="form-input" id="sf-order" type="number" min="0" value="${skill?.sort_order ?? 0}" style="width:100px;"></div>
      <div class="admin-modal__actions">
        <button class="btn btn--secondary" data-cancel>Cancel</button>
        <button class="btn btn--primary" data-save>${skill ? 'Save' : 'Add'}</button>
      </div>
    `);
    overlay.querySelector('[data-cancel]').addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-save]').addEventListener('click', async () => {
      const payload = {
        name:              overlay.querySelector('#sf-name').value.trim(),
        skill_category_id: parseInt(overlay.querySelector('#sf-cat').value, 10),
        proficiency:       null,  // percentages are no longer shown
        sort_order:        parseInt(overlay.querySelector('#sf-order').value, 10) || 0,
      };
      if (!payload.name) { showToast('Name is required.', 'error'); return; }
      try {
        const res = skill
          ? await adminApi.put(`/api/admin/skills/${skill.id}`, payload)
          : await adminApi.post('/api/admin/skills', payload);
        showToast(skill ? 'Skill updated.' : 'Skill added.');
        overlay.remove();
        renderSkillList(res.skillCategories);
      } catch (err) { showToast(err.message, 'error'); }
    });
    overlay.querySelector('#sf-name').focus();
  }

  // ============================================================
  // SECTIONS: RESEARCH INTERESTS, EDUCATION, EXPERIENCE
  // ============================================================
  // Each is a list edited with repeatableList and saved as a whole.
  // Empty lists hide the matching homepage section automatically.

  function listEditorPage({ panelId, title, description, saveLabel, extraHtml = '' }) {
    const panel = document.getElementById(panelId);
    panel.innerHTML = `
      <div style="max-width:820px;">
        <div class="admin-section-head">
          <div>
            <h2>${title}</h2>
            <p>${description}</p>
          </div>
        </div>
        ${extraHtml}
        <div class="card" style="padding:var(--space-6);">
          <div data-list></div>
        </div>
        <div class="admin-modal__actions" style="margin-top:var(--space-6);">
          <button class="btn btn--primary" data-save>${saveLabel}</button>
        </div>
      </div>
    `;
    return panel;
  }

  async function withSaving(btn, fn) {
    btn.disabled = true;
    try { await fn(); } catch (err) { showToast(`Failed to save: ${err.message}`, 'error'); } finally { btn.disabled = false; }
  }

  sectionLoaders.research = async function loadResearch() {
    const panel = document.getElementById('research-panel-content');
    panel.innerHTML = `<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>`;
    try {
      const { settings } = await adminApi.get('/api/admin/settings');
      let items = [];
      try { items = JSON.parse(settings['research.items'] || '[]'); } catch { items = []; }

      listEditorPage({
        panelId: 'research-panel-content',
        title: 'Research Interests',
        description: 'The areas you want to work on — shown on your homepage between About and Projects. Keep each one specific: reviewers compare this with your statement of purpose.',
        saveLabel: 'Save Research Interests',
        extraHtml: `
          <div class="card" style="padding:var(--space-6);margin-bottom:var(--space-5);">
            <div class="form-group">
              <label class="form-label" for="ri-headline">Section Heading</label>
              <input class="form-input" id="ri-headline" value="${esc(settings['research.headline'] || '')}" placeholder="Research Interests">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="ri-intro">Introduction <span class="form-label__hint">(optional; blank line between paragraphs)</span></label>
              <textarea class="form-textarea" id="ri-intro" rows="3" placeholder="e.g. I am interested in how machine learning models behave when the data they see in deployment differs from their training data…">${esc(settings['research.intro'] || '')}</textarea>
            </div>
          </div>`,
      });

      const list = repeatableList(panel.querySelector('[data-list]'), {
        fields: [
          { key: 'title',       label: 'Area',        placeholder: 'e.g. Distribution shift & model reliability', wide: true },
          { key: 'description', label: 'Description', type: 'textarea', placeholder: 'One or two sentences: what interests you and which of your projects relate to it.', wide: true },
        ],
        items,
        addLabel: '+ Add research area',
        emptyText: 'No research areas yet — the homepage section stays hidden until you add one (or an introduction).',
      });

      panel.querySelector('[data-save]').addEventListener('click', (e) => withSaving(e.currentTarget, async () => {
        const entries = list.getItems();
        if (entries.some((x) => !x.title)) { showToast('Every research area needs a name.', 'error'); return; }
        await adminApi.put('/api/admin/settings', {
          'research.headline': panel.querySelector('#ri-headline').value.trim(),
          'research.intro':    panel.querySelector('#ri-intro').value.trim(),
          'research.items':    JSON.stringify(entries),
        });
        showToast('Research interests saved.');
      }));
    } catch (err) {
      panel.innerHTML = `<div class="empty-state"><h3>Failed to load</h3><p>${esc(err.message)}</p></div>`;
    }
  };

  sectionLoaders.education = async function loadEducation() {
    const panel = document.getElementById('education-panel-content');
    panel.innerHTML = `<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>`;
    try {
      const { items } = await adminApi.get('/api/admin/education');
      listEditorPage({
        panelId: 'education-panel-content',
        title: 'Education',
        description: 'Your degrees, most recent first. Shown in the "Education &amp; Experience" section of your homepage.',
        saveLabel: 'Save Education',
      });
      const list = repeatableList(panel.querySelector('[data-list]'), {
        fields: [
          { key: 'degree',      label: 'Degree *',      placeholder: 'B.E. Computer Science and Engineering', wide: true },
          { key: 'institution', label: 'Institution *', placeholder: 'University / college name', wide: true },
          { key: 'location',    label: 'Location',      placeholder: 'City, Country' },
          { key: 'grade',       label: 'Grade',         placeholder: 'CGPA 8.5 / 10 (optional)' },
          { key: 'start_label', label: 'Start',         placeholder: 'Aug 2022' },
          { key: 'end_label',   label: 'End',           placeholder: 'May 2026 or Expected May 2026' },
          { key: 'highlights',  label: 'Highlights',    type: 'textarea', placeholder: 'One per line — e.g. Relevant coursework: Probability & Statistics, Machine Learning\nFinal-year project: …', wide: true },
        ],
        items,
        addLabel: '+ Add degree',
        emptyText: 'No education added yet.',
      });
      panel.querySelector('[data-save]').addEventListener('click', (e) => withSaving(e.currentTarget, async () => {
        const entries = list.getItems();
        if (entries.some((x) => !x.degree || !x.institution)) { showToast('Each entry needs a degree and an institution.', 'error'); return; }
        await adminApi.put('/api/admin/education', { items: entries });
        showToast('Education saved.');
      }));
    } catch (err) {
      panel.innerHTML = `<div class="empty-state"><h3>Failed to load</h3><p>${esc(err.message)}</p></div>`;
    }
  };

  const EXPERIENCE_TYPES = ['', 'Internship', 'Research', 'Full-time', 'Part-time', 'Freelance', 'Teaching', 'Volunteer'];

  sectionLoaders.experience = async function loadExperience() {
    const panel = document.getElementById('experience-panel-content');
    panel.innerHTML = `<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>`;
    try {
      const { items } = await adminApi.get('/api/admin/experience');
      listEditorPage({
        panelId: 'experience-panel-content',
        title: 'Experience',
        description: 'Internships, research positions and jobs, most recent first. Describe what you did and the result, one point per line.',
        saveLabel: 'Save Experience',
      });
      const list = repeatableList(panel.querySelector('[data-list]'), {
        fields: [
          { key: 'role',             label: 'Role *',         placeholder: 'Machine Learning Intern', wide: true },
          { key: 'organization',     label: 'Organization *', placeholder: 'Company / lab name' },
          { key: 'organization_url', label: 'Website',        placeholder: 'https://… (optional)' },
          { key: 'employment_type',  label: 'Type',           type: 'select', options: EXPERIENCE_TYPES },
          { key: 'location',         label: 'Location',       placeholder: 'City / Remote' },
          { key: 'start_label',      label: 'Start',          placeholder: 'May 2026' },
          { key: 'end_label',        label: 'End',            placeholder: 'Jul 2026 or Present' },
          { key: 'highlights',       label: 'What you did',   type: 'textarea', placeholder: 'One per line — e.g. Built a predictive-maintenance pipeline on sensor data…', wide: true },
        ],
        items,
        addLabel: '+ Add experience',
        emptyText: 'No experience added yet.',
      });
      panel.querySelector('[data-save]').addEventListener('click', (e) => withSaving(e.currentTarget, async () => {
        const entries = list.getItems();
        if (entries.some((x) => !x.role || !x.organization)) { showToast('Each entry needs a role and an organization.', 'error'); return; }
        await adminApi.put('/api/admin/experience', { items: entries });
        showToast('Experience saved.');
      }));
    } catch (err) {
      panel.innerHTML = `<div class="empty-state"><h3>Failed to load</h3><p>${esc(err.message)}</p></div>`;
    }
  };

  // ============================================================
  // SECTION: JOURNEY (homepage timeline, stored in settings)
  // ============================================================
  // Category drives the coloured tag on each homepage entry
  const JOURNEY_CATEGORIES = ['Learning Journey', 'Projects', 'Research', 'Certifications', 'Achievements', 'Experience'];

  sectionLoaders.journey = async function loadJourney() {
    const panel = document.getElementById('journey-panel-content');
    panel.innerHTML = `<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>`;
    try {
      const { settings } = await adminApi.get('/api/admin/settings');
      let items = [];
      try { items = JSON.parse(settings['timeline.items'] || '[]'); } catch { items = []; }

      panel.innerHTML = `
        <div style="max-width:820px;">
          <div class="admin-section-head">
            <div>
              <h2>Journey</h2>
              <p>The "Learning Journey &amp; Milestones" timeline on your homepage, shown top to bottom in this order.</p>
            </div>
          </div>
          <div class="card" style="padding:var(--space-6);">
            <div id="journey-list"></div>
          </div>
          <div class="admin-modal__actions" style="margin-top:var(--space-6);">
            <button class="btn btn--primary" id="journey-save-btn">Save Journey</button>
          </div>
        </div>
      `;

      const list = repeatableList(document.getElementById('journey-list'), {
        fields: [
          { key: 'year',        label: 'Year',     placeholder: '2025' },
          { key: 'category',    label: 'Type',     type: 'select', options: JOURNEY_CATEGORIES },
          { key: 'title',       label: 'Title',    placeholder: 'Started CS Undergrad', wide: true },
          { key: 'description', label: 'Description', type: 'textarea', wide: true },
        ],
        items,
        addLabel: '+ Add milestone',
        emptyText: 'No milestones yet — the homepage will show "Timeline coming soon".',
      });

      document.getElementById('journey-save-btn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const entries = list.getItems();
        if (entries.some((x) => !x.title)) { showToast('Every milestone needs a title.', 'error'); return; }
        btn.disabled = true;
        try {
          await adminApi.put('/api/admin/settings', { 'timeline.items': JSON.stringify(entries) });
          showToast('Journey saved.');
        } catch (err) {
          showToast(`Failed to save: ${err.message}`, 'error');
        } finally { btn.disabled = false; }
      });
    } catch (err) {
      panel.innerHTML = `<div class="empty-state"><h3>Failed to load journey</h3><p>${esc(err.message)}</p></div>`;
    }
  };

  // ============================================================
  // SECTION: SETTINGS
  // ============================================================
  sectionLoaders.settings = async function loadSettings() {
    const panel = document.getElementById('settings-panel-content');
    panel.innerHTML = `<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>`;

    try {
      const { settings } = await adminApi.get('/api/admin/settings');

      const SETTING_GROUPS = [
        {
          label: 'Site Identity',
          fields: [
            { key: 'site.name',        label: 'Your Name',        type: 'text', hint: 'Shown in the logo, footer and page titles.' },
            { key: 'site.title',       label: 'Homepage Title',   type: 'text', hint: 'Browser tab and search-result title for the homepage.' },
            { key: 'site.tagline',     label: 'Tagline',          type: 'text', hint: 'The small line above the hero headline.' },
            { key: 'site.description', label: 'Meta Description', type: 'textarea', hint: 'Shown in search results and link previews. ~150 characters works best.' },
          ],
        },
        {
          label: 'Hero Section',
          fields: [
            { key: 'hero.headline',            label: 'Headline',              type: 'textarea', rows: 2, hint: 'Wrap words in *asterisks* to give them the gradient highlight.' },
            { key: 'hero.subheadline',         label: 'Subheadline',           type: 'textarea', rows: 2 },
            { key: 'hero.cta_primary_label',   label: 'Primary Button Label',  type: 'text', hint: 'Links to your Projects page.' },
            { key: 'hero.cta_secondary_label', label: 'Secondary Button Label', type: 'text' },
            { key: 'hero.cta_secondary_url',   label: 'Secondary Button Link', type: 'text', hint: 'A full URL (opens in a new tab) or a page section like #contact.' },
          ],
        },
        {
          label: 'About Section',
          fields: [
            { key: 'about.headline', label: 'Headline',   type: 'textarea', rows: 2 },
            { key: 'about.body',     label: 'Body Text',  type: 'textarea', rows: 6, hint: 'Leave a blank line between paragraphs.' },
          ],
        },
        {
          label: 'Contact & Social',
          fields: [
            { key: 'contact.email',      label: 'Email Address', type: 'email' },
            { key: 'contact.github',     label: 'GitHub URL',    type: 'url' },
            { key: 'contact.linkedin',   label: 'LinkedIn URL',  type: 'url' },
          ],
        },
        {
          label: 'CV',
          fields: [
            { key: 'cv.file', label: 'CV (PDF)', type: 'pdf', hint: 'Visitors download it from the CV button in the menu, the Contact section and the footer. It is always served at /cv.pdf, so that link stays the same when you upload a new version.' },
            { key: 'contact.resume_url', label: 'External CV link (fallback)', type: 'url', hint: 'Only used while no PDF is uploaded above. Leave both empty to hide the CV links.' },
          ],
        },
        {
          label: 'Contact Section',
          fields: [
            { key: 'contact.headline', label: 'Heading', type: 'text', hint: "Defaults to \"Let's build something intelligent\"." },
            { key: 'contact.body',     label: 'Message', type: 'textarea', rows: 2, hint: 'e.g. what you are looking for — graduate research positions, internships, collaborations.' },
          ],
        },
        {
          label: 'Link Preview',
          fields: [
            { key: 'og.image', label: 'Preview Image', type: 'image', hint: 'Shown when your site is shared on LinkedIn, WhatsApp, Slack, etc. Use 1200 × 630 px. Projects use their own thumbnail.' },
          ],
        },
        {
          label: 'Footer',
          fields: [
            { key: 'footer.tagline', label: 'Footer Tagline', type: 'text' },
          ],
        },
      ];

      const fieldId = (key) => `setting-${key.replace(/\./g, '-')}`;
      const fieldControl = ({ key, type, rows = 3 }) => {
        if (type === 'image')    return `<div id="${fieldId(key)}"></div>`;
        // PDF: the hidden input carries the uploaded path into the save
        if (type === 'pdf') return `
          <input type="hidden" data-key="${key}" value="${esc(settings[key] || '')}">
          <div class="file-field" id="${fieldId(key)}"></div>`;
        if (type === 'textarea') return `<textarea class="form-textarea" id="${fieldId(key)}" data-key="${key}" rows="${rows}">${esc(settings[key] || '')}</textarea>`;
        return `<input class="form-input" id="${fieldId(key)}" data-key="${key}" type="${type}" value="${esc(settings[key] || '')}">`;
      };

      panel.innerHTML = `
        <div style="max-width:720px;">
          <div class="admin-section-head">
            <div>
              <h2>Site Settings</h2>
              <p>Changes here update what visitors see on your portfolio — no code required.</p>
            </div>
          </div>

          ${SETTING_GROUPS.map((group) => `
            <div class="card" style="padding:var(--space-6);margin-bottom:var(--space-5);">
              <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);margin-bottom:var(--space-5);">${group.label}</div>
              ${group.fields.map((f) => `
                <div class="form-group">
                  <label class="form-label" for="${fieldId(f.key)}">${f.label}</label>
                  ${fieldControl(f)}
                  ${f.hint ? `<p class="form-hint">${esc(f.hint)}</p>` : ''}
                </div>
              `).join('')}
            </div>
          `).join('')}

          <div style="display:flex;gap:var(--space-3);justify-content:flex-end;margin-top:var(--space-6);">
            <button class="btn btn--primary" id="settings-save-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save All Settings
            </button>
          </div>
        </div>
      `;

      // Image settings get an upload zone instead of a text box
      const imageUploaders = {};
      SETTING_GROUPS.flatMap((g) => g.fields).filter((f) => f.type === 'image').forEach((f) => {
        imageUploaders[f.key] = Uploader.singleImage(document.getElementById(fieldId(f.key)), {
          type: f.key.replace(/\./g, '-'),
          hint: 'PNG or JPG · 1200 × 630 px · max 8 MB',
          initialPath: settings[f.key] || null,
        });
      });

      // PDF settings (the CV): upload, view, replace, remove
      SETTING_GROUPS.flatMap((g) => g.fields).filter((f) => f.type === 'pdf').forEach((f) => {
        const host   = document.getElementById(fieldId(f.key));
        const hidden = panel.querySelector(`input[type="hidden"][data-key="${f.key}"]`);

        const render = () => {
          const path = hidden.value;
          host.innerHTML = `
            ${path ? `
              <div class="file-field__current">
                <span>📄</span>
                <a href="${esc(path)}" target="_blank" rel="noopener">${esc(path.split('/').pop())}</a>
              </div>` : '<span class="form-hint" style="margin:0;">No PDF uploaded.</span>'}
            <label class="btn btn--secondary btn--sm" style="cursor:pointer;">
              ${path ? 'Replace PDF' : 'Upload PDF'}
              <input type="file" accept="application/pdf,.pdf" hidden>
            </label>
            ${path ? '<button type="button" class="btn btn--ghost btn--sm" data-remove style="color:var(--danger);">Remove</button>' : ''}
          `;
          host.querySelector('input[type="file"]').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { showToast('Please choose a PDF file.', 'error'); return; }
            const form = new FormData();
            form.append('file', file);
            try {
              const res = await adminApi.postForm('/api/admin/upload/document', form);
              hidden.value = res.filePath;
              render();
              showToast('PDF uploaded — click "Save All Settings" to publish it.');
            } catch (err) { showToast(`Upload failed: ${err.message}`, 'error'); }
          });
          host.querySelector('[data-remove]')?.addEventListener('click', () => { hidden.value = ''; render(); });
        };
        render();
      });

      document.getElementById('settings-save-btn').addEventListener('click', async () => {
        const btn = document.getElementById('settings-save-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';

        const updates = {};
        panel.querySelectorAll('[data-key]').forEach((el) => {
          updates[el.dataset.key] = el.value.trim();
        });
        Object.entries(imageUploaders).forEach(([key, up]) => { updates[key] = up.getPath() || ''; });

        try {
          await adminApi.put('/api/admin/settings', updates);
          showToast('Settings saved successfully!');
        } catch (err) {
          showToast(`Failed to save: ${err.message}`, 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save All Settings';
        }
      });

    } catch (err) {
      panel.innerHTML = `<div class="empty-state"><h3>Failed to load settings</h3><p>${esc(err.message)}</p></div>`;
    }
  };

  // ============================================================
  // THEME TOGGLE LABEL SYNC
  // ============================================================
  function syncThemeLabel() {
    const label = document.getElementById('theme-label');
    if (label) {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      label.textContent = isDark ? 'Light mode' : 'Dark mode';
    }
  }
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => setTimeout(syncThemeLabel, 50));
  });
  syncThemeLabel();

  // ============================================================
  // BOOT
  // ============================================================
  (async function init() {
    await guardAuth();
    activateSection(getActiveSection());
    // Sidebar project count, whichever section the page opened on
    if (getActiveSection() !== 'dashboard') {
      adminApi.getDashboard()
        .then(({ dashboard }) => { document.getElementById('badge-total').textContent = dashboard.projects.total; })
        .catch(() => {});
    }
  })();

})();
