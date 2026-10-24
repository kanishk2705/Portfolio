// assets/js/cards.js
// ---------------------------------------------------------------
// Markup shared by every public page, so a project looks the same
// on the homepage, the projects archive and in "Related Projects".
//
// window.Portfolio:
//   esc(str)              HTML-escape DB text
//   url('/projects')      site path with the base path prepended
//   formatMonth('2026-03') → "Mar 2026"
//   statusLabel(p)        "Completed · Mar 2026" / "Ongoing" / "Planned"
//   statusBadge(p)        badge HTML for a project's status
//   projectCard(p, opts)  full project card (<a> element HTML)
// ---------------------------------------------------------------
'use strict';

(function () {
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Site path → URL, adding the base path on GitHub Pages ("/Portfolio")
  const BASE = document.querySelector('meta[name="site-base"]')?.content || '';
  const url = (path) => BASE + path;

  const MONTHS =['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function formatMonth(ym) {
    const m = /^(\d{4})-(\d{2})$/.exec(ym || '');
    return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : '';
  }

  const STATUS_NAMES = { completed: 'Completed', ongoing: 'Ongoing', planned: 'Planned' };

  function statusLabel(p) {
    const status = p.project_status || 'completed';
    if (status === 'completed' && p.completed_on) return `Completed · ${formatMonth(p.completed_on)}`;
    return STATUS_NAMES[status] || '';
  }

  function statusBadge(p) {
    const status = p.project_status || 'completed';
    return `<span class="status-badge status-badge--${esc(status)}"><span class="status-badge__dot"></span>${esc(statusLabel(p))}</span>`;
  }

  // reveal: add the scroll-in animation hook (the page must observe [data-reveal])
  function projectCard(p, { reveal = false } = {}) {
    const techChips = (p.technologies || []).slice(0, 4)
      .map((t) => `<span class="badge">${esc(t.name)}</span>`).join('');

    const thumb = p.thumbnail_path
      ? `<img src="${esc(p.thumbnail_path)}" alt="${esc(p.title)} thumbnail" loading="lazy">`
      : `<div class="project-card__thumb-placeholder"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg></div>`;

    return `
      <a href="${esc(url(`/project/${p.slug}/`))}" class="card card--hover project-card"${reveal ? ' data-reveal' : ''}>
        <div class="project-card__thumb">
          ${thumb}
          ${p.category ? `<span class="project-card__category">${esc(p.category)}</span>` : ''}
        </div>
        <div class="project-card__body">
          <div class="project-card__status">${statusBadge(p)}</div>
          <h3 class="project-card__title">${esc(p.title)}</h3>
          <p class="project-card__desc">${esc(p.short_description)}</p>
          ${techChips ? `<div class="project-card__tags">${techChips}</div>` : ''}
          <div class="project-card__footer">
            <span class="btn btn--ghost btn--sm" style="padding-left:0;">View Project →</span>
          </div>
        </div>
      </a>
    `;
  }

  window.Portfolio = { esc, url, formatMonth, statusLabel, statusBadge, projectCard };
})();
