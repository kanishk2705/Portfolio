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

  // ---- Confirm dialog (tiny inline modal) ----
  function confirmAction(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `position:fixed;inset:0;background:var(--bg-overlay);z-index:9000;display:flex;align-items:center;justify-content:center;padding:var(--space-6)`;
      overlay.innerHTML = `
        <div class="card" style="max-width:380px;width:100%;padding:var(--space-8);">
          <h3 style="font-size:var(--text-lg);margin-bottom:var(--space-3);">Are you sure?</h3>
          <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-6);">${esc(message)}</p>
          <div style="display:flex;gap:var(--space-3);justify-content:flex-end;">
            <button class="btn btn--secondary" id="confirm-cancel">Cancel</button>
            <button class="btn btn--primary" style="background:var(--danger);border:none;" id="confirm-ok">Delete</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
      overlay.querySelector('#confirm-ok').onclick    = () => { overlay.remove(); resolve(true); };
    });
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
  const SECTIONS = ['dashboard', 'projects', 'categories', 'certificates', 'settings'];
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

    const titles = { dashboard: 'Dashboard', projects: 'Projects', categories: 'Categories', certificates: 'Certifications', settings: 'Site Settings' };
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
  let allCategories    = [];

  // Active editor instances (destroyed on drawer close)
  let _editors   = {};
  let _uploaders = {};

  async function openProjectDrawer(projectId = null) {
    editingProjectId = projectId;
    drawerTitle.textContent = projectId ? 'Edit Project' : 'New Project';

    // Destroy old editor/uploader instances
    Object.values(_editors).forEach(e => e?.destroy?.());
    Object.values(_uploaders).forEach(u => {}); // uploaders are DOM-bound, cleared by innerHTML reset
    _editors = {}; _uploaders = {};

    // Load categories for select
    try {
      const { categories } = await adminApi.get('/api/admin/categories');
      allCategories = categories;
    } catch { allCategories = []; }

    let project = null;
    if (projectId) {
      try {
        const res = await adminApi.get(`/api/admin/projects/${projectId}`);
        project = res.project;
      } catch (err) { showToast(`Failed to load project: ${err.message}`, 'error'); return; }
    }

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
    _editors = {}; _uploaders = {};
    drawer.style.display = 'none';
    document.body.style.overflow = '';
    editingProjectId = null;
  }

  drawerClose.addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.style.display !== 'none') closeDrawer(); });

  // ---- Build drawer HTML (tabs + both panels) ----
  function buildProjectForm(p) {
    const catOptions = allCategories.map((c) =>
      `<option value="${c.id}" ${p?.category_id == c.id ? 'selected' : ''}>${esc(c.name)}</option>`
    ).join('');

    const techValue = (p?.technologies || []).map((t) => t.name).join(', ');
    const tagValue  = (p?.tags || []).map((t) => t.name).join(', ');
    const metricsValue = (p?.metrics || []).map((m) => `${m.metric_label}: ${m.metric_value}`).join('\n');

    const RICH_FIELDS = [
      { id: 'overview',               label: 'Overview',                placeholder: 'Project overview…' },
      { id: 'problem_statement',      label: 'Problem Statement',       placeholder: 'What problem does this solve?' },
      { id: 'dataset_info',           label: 'Dataset Information',     placeholder: 'Describe the dataset(s) used…' },
      { id: 'methodology',            label: 'Methodology',             placeholder: 'Explain the approach…' },
      { id: 'implementation_details', label: 'Implementation Details',  placeholder: 'Architecture, libraries, key decisions…' },
      { id: 'results',                label: 'Results',                 placeholder: 'What did you achieve?' },
      { id: 'future_improvements',    label: 'Future Improvements',     placeholder: 'What comes next?' },
    ];

    return `
      <!-- Tab buttons -->
      <div class="drawer-tabs">
        <button class="drawer-tab is-active" data-tab="content">Content</button>
        <button class="drawer-tab" data-tab="media">Media & Files</button>
      </div>

      <!-- ══ CONTENT TAB ══ -->
      <div class="drawer-tab-panel is-active" data-panel="content">
        <div style="display:flex;flex-direction:column;gap:var(--space-5);">

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

          <!-- Rich text fields -->
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);margin-bottom:var(--space-4);">Project Write-up</div>
            ${RICH_FIELDS.map(({ id, label, placeholder }) => `
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
    const RICH_FIELDS = [
      'overview', 'problem_statement', 'dataset_info',
      'methodology', 'implementation_details', 'results', 'future_improvements',
    ];
    const PLACEHOLDERS = {
      overview: 'Project overview…',
      problem_statement: 'What problem does this solve?',
      dataset_info: 'Describe the dataset(s) used…',
      methodology: 'Explain the approach…',
      implementation_details: 'Architecture, libraries, key decisions…',
      results: 'What did you achieve?',
      future_improvements: 'What comes next?',
    };

    RICH_FIELDS.forEach((field) => {
      const host = document.getElementById(`rte-wrap-${field}`);
      if (!host) return;
      _editors[field] = Editor.create(host, {
        placeholder: PLACEHOLDERS[field],
        initialHtml: p?.[field] || '',
      });
    });

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
    ['overview','problem_statement','dataset_info','methodology','implementation_details','results','future_improvements'].forEach((f) => {
      richFields[f] = _editors[f] ? _editors[f].getHtml() : getValue(`pf-${f}`) || null;
    });

    // Metrics (text → array)
    const metricsRaw = getValue('pf-metrics') || '';
    const metrics = metricsRaw.split('\n').map(l => l.trim()).filter(Boolean)
      .map(l => { const i = l.indexOf(':'); return i === -1 ? null : { label: l.slice(0,i).trim(), value: l.slice(i+1).trim() }; })
      .filter(Boolean);

    const parseCsv = (id) => (getValue(id)||'').split(',').map(s=>s.trim()).filter(Boolean);

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

      technologies: parseCsv('pf-tech'),
      tags:         parseCsv('pf-tags'),
      metrics,
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
    overlay.style.cssText = `position:fixed;inset:0;background:var(--bg-overlay);z-index:9000;display:flex;align-items:center;justify-content:center;padding:var(--space-6)`;
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
    overlay.style.cssText = `position:fixed;inset:0;background:var(--bg-overlay);z-index:9000;display:flex;align-items:center;justify-content:center;padding:var(--space-6)`;
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
            { key: 'site.title',       label: 'Site Title',       type: 'text' },
            { key: 'site.tagline',     label: 'Tagline',          type: 'text' },
            { key: 'site.description', label: 'Meta Description', type: 'textarea' },
          ],
        },
        {
          label: 'Hero Section',
          fields: [
            { key: 'hero.headline',            label: 'Headline',              type: 'textarea', rows: 2 },
            { key: 'hero.subheadline',         label: 'Subheadline',           type: 'textarea', rows: 2 },
            { key: 'hero.cta_primary_label',   label: 'Primary CTA Label',     type: 'text' },
            { key: 'hero.cta_secondary_label', label: 'Secondary CTA Label',   type: 'text' },
          ],
        },
        {
          label: 'About Section',
          fields: [
            { key: 'about.headline', label: 'Headline',   type: 'textarea', rows: 2 },
            { key: 'about.body',     label: 'Body Text',  type: 'textarea', rows: 5 },
          ],
        },
        {
          label: 'Contact & Social',
          fields: [
            { key: 'contact.email',      label: 'Email Address', type: 'email' },
            { key: 'contact.github',     label: 'GitHub URL',    type: 'url' },
            { key: 'contact.linkedin',   label: 'LinkedIn URL',  type: 'url' },
            { key: 'contact.resume_url', label: 'Resume URL',    type: 'url' },
          ],
        },
        {
          label: 'Footer',
          fields: [
            { key: 'footer.tagline', label: 'Footer Tagline', type: 'text' },
          ],
        },
      ];

      panel.innerHTML = `
        <div style="max-width:720px;">
          <div style="margin-bottom:var(--space-6);">
            <h2 style="font-size:var(--text-2xl);margin-bottom:var(--space-1);">Site Settings</h2>
            <p style="color:var(--text-secondary);font-size:var(--text-sm);">Changes here update what visitors see on your portfolio — no code required.</p>
          </div>

          ${SETTING_GROUPS.map((group) => `
            <div class="card" style="padding:var(--space-6);margin-bottom:var(--space-5);">
              <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-tertiary);margin-bottom:var(--space-5);">${group.label}</div>
              ${group.fields.map(({ key, label, type, rows = 3 }) => `
                <div class="form-group">
                  <label class="form-label" for="setting-${key.replace(/\./g,'-')}">${label}</label>
                  ${type === 'textarea'
                    ? `<textarea class="form-textarea" id="setting-${key.replace(/\./g,'-')}" data-key="${key}" rows="${rows}">${esc(settings[key]||'')}</textarea>`
                    : `<input class="form-input" id="setting-${key.replace(/\./g,'-')}" data-key="${key}" type="${type}" value="${esc(settings[key]||'')}">`}
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

      document.getElementById('settings-save-btn').addEventListener('click', async () => {
        const btn = document.getElementById('settings-save-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';

        const updates = {};
        panel.querySelectorAll('[data-key]').forEach((el) => {
          updates[el.dataset.key] = el.value;
        });

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
  })();

})();
