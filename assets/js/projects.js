// assets/js/projects.js
// ---------------------------------------------------------------
// Drives the /projects page: debounced search, category filter
// chips (with live counts), status filter, animated grid re-render, pagination,
// and URL query-string sync so filtered views are shareable/bookmarkable.
// ---------------------------------------------------------------
'use strict';

(function () {
  const state = {
    category: 'all',
    status:   'all',
    search:   '',
    page:     1,
    limit:    9,
  };

  const grid         = document.getElementById('project-grid');
  const chipsWrap     = document.getElementById('filter-chips');
  const statusWrap    = document.getElementById('status-filter');
  const searchInput   = document.getElementById('search-input');
  const resultsMeta    = document.getElementById('results-meta');
  const resultsCount   = document.getElementById('results-count');
  const paginationWrap = document.getElementById('pagination');

  const { esc, projectCard } = window.Portfolio;

  // ---- Read initial state from URL ----
  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    state.category = params.get('category') || 'all';
    state.status   = params.get('status') || 'all';
    state.search   = params.get('search') || '';
    state.page     = parseInt(params.get('page'), 10) || 1;
    if (searchInput) searchInput.value = state.search;
  }

  function writeUrlState() {
    const params = new URLSearchParams();
    if (state.category !== 'all') params.set('category', state.category);
    if (state.status !== 'all') params.set('status', state.status);
    if (state.search) params.set('search', state.search);
    if (state.page > 1) params.set('page', state.page);
    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, '', url);
  }

  // ---- Category chips (with live counts) ----
  async function renderChips() {
    try {
      // Each category carries its published project_count; the "All" total
      // also includes uncategorised projects, so it comes from the list API.
      const [{ categories }, allResult] = await Promise.all([
        api.getCategories(),
        api.getProjects({ page: 1, limit: 1 }),
      ]);

      const allChip = chipsWrap.querySelector('[data-category="all"]');
      allChip.innerHTML = `All <span class="filter-chip__count">${allResult.pagination.total}</span>`;

      categories.forEach((cat) => {
        const count = cat.project_count;
        if (count === 0) return; // don't show empty categories as filter noise

        const btn = document.createElement('button');
        btn.className = 'filter-chip';
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', 'false');
        btn.dataset.category = cat.slug;
        btn.innerHTML = `${esc(cat.name)} <span class="filter-chip__count">${count}</span>`;
        chipsWrap.appendChild(btn);
      });

      // Activate the chip matching current state (in case of deep link)
      setActiveChip(state.category);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  function setActiveChip(category) {
    chipsWrap.querySelectorAll('.filter-chip').forEach((chip) => {
      const isActive = chip.dataset.category === category;
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-selected', String(isActive));
    });
  }

  chipsWrap.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    state.category = chip.dataset.category;
    state.page = 1;
    setActiveChip(state.category);
    writeUrlState();
    loadProjects();
  });

  // ---- Search (debounced) ----
  let searchTimer;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = searchInput.value.trim();
        state.page = 1;
        writeUrlState();
        loadProjects();
      }, 300);
    });
  }

  // ---- Status filter: only shown when projects have more than one status ----
  async function renderStatusFilter() {
    try {
      const statuses = ['completed', 'ongoing', 'planned'];
      const totals = await Promise.all(statuses.map((status) =>
        api.getProjects({ status, page: 1, limit: 1 }).then((r) => r.pagination.total)));
      statuses.forEach((status, i) => {
        statusWrap.querySelector(`[data-status="${status}"]`).hidden = totals[i] === 0;
      });
      statusWrap.hidden = totals.filter((n) => n > 0).length < 2 && state.status === 'all';
      setActiveStatus(state.status);
    } catch (err) {
      console.error('Failed to load status counts:', err);
    }
  }

  function setActiveStatus(status) {
    statusWrap.querySelectorAll('.status-filter__btn').forEach((btn) => {
      const isActive = btn.dataset.status === status;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  statusWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.status-filter__btn');
    if (!btn) return;
    state.status = btn.dataset.status;
    state.page = 1;
    setActiveStatus(state.status);
    writeUrlState();
    loadProjects();
  });

  // ---- Pagination ----
  function renderPagination(pagination) {
    const { page, totalPages } = pagination;

    if (totalPages <= 1) {
      paginationWrap.style.display = 'none';
      paginationWrap.innerHTML = '';
      return;
    }

    paginationWrap.style.display = 'flex';

    const pages = [];
    const windowSize = 1;
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= page - windowSize && p <= page + windowSize)) {
        pages.push(p);
      } else if (pages[pages.length - 1] !== '…') {
        pages.push('…');
      }
    }

    let html = `<button class="pagination__btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>`;
    for (const p of pages) {
      html += p === '…'
        ? `<span class="pagination__ellipsis">…</span>`
        : `<button class="pagination__btn ${p === page ? 'is-active' : ''}" data-page="${p}">${p}</button>`;
    }
    html += `<button class="pagination__btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''} aria-label="Next page">›</button>`;

    paginationWrap.innerHTML = html;
  }

  paginationWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.pagination__btn');
    if (!btn || btn.disabled) return;
    state.page = parseInt(btn.dataset.page, 10);
    writeUrlState();
    loadProjects();
    document.querySelector('.projects-toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---- Main load ----
  async function loadProjects() {
    grid.classList.remove('project-grid--animated');
    grid.style.opacity = '0.4';

    try {
      const { projects, pagination } = await api.getProjects(state);

      if (!projects.length) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1/-1;">
            <h3>No projects found</h3>
            <p>${state.search
              ? `Nothing matches "${esc(state.search)}". Try a different search term.`
              : 'No projects match these filters yet.'}</p>
          </div>`;
        resultsMeta.style.display = 'none';
        paginationWrap.style.display = 'none';
      } else {
        grid.innerHTML = projects.map((p) => projectCard(p)).join('');
        grid.classList.add('project-grid--animated');

        resultsMeta.style.display = 'flex';
        resultsCount.textContent = pagination.total;

        renderPagination(pagination);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><h3>Couldn't load projects</h3><p>Please try refreshing the page.</p></div>`;
    } finally {
      grid.style.opacity = '1';
    }
  }

  // ---- Boot ----
  readUrlState();
  renderChips();
  renderStatusFilter();
  loadProjects();
})();
