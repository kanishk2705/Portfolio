// assets/js/home.js
// ---------------------------------------------------------------
// Renders all dynamic sections of the homepage:
//   settings (hero/about/contact/footer text + links)
//   skills grid, featured projects, certifications, timeline, stats
// ---------------------------------------------------------------
'use strict';

(function () {
  // ---- tiny HTML-escape helper for any DB-sourced text we inject ----
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  document.querySelector('[data-current-year]').textContent = new Date().getFullYear();

  // ---- Skill category icons (inline SVG, stroke-based, brand-neutral) ----
  const ICONS = {
    ml:    '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/>',
    dl:    '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="9" y="14" width="6" height="6" rx="1"/><path d="M7 10v2a2 2 0 002 2h0M17 10v2a2 2 0 01-2 2h0"/>',
    genai: '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8-1.8-.7 1.8-.7z"/>',
    nlp:   '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
    ds:    '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
    de:    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>',
    mlops: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
    python:'<path d="M12 2C8 2 8 5 8 5v3h4M12 2c4 0 4 3 4 3v3H8M12 22c4 0 4-3 4-3v-3h-4M12 22c-4 0-4-3-4-3v-3h8"/>',
    cloud: '<path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>',
  };
  function iconSvg(key) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[key] || ICONS.ml}</svg>`;
  }

  // ---- Settings: text / html / href bindings ----
  async function applySettings() {
    try {
      const { settings } = await api.getPublicSettings();

      document.querySelectorAll('[data-settings-text]').forEach((el) => {
        const key = el.getAttribute('data-settings-text');
        if (settings[key]) el.textContent = settings[key];
      });

      document.querySelectorAll('[data-settings-html]').forEach((el) => {
        const key = el.getAttribute('data-settings-html');
        if (settings[key]) {
          el.innerHTML = settings[key]
            .split('\n\n')
            .filter(Boolean)
            .map((para) => `<p>${esc(para)}</p>`)
            .join('');
        }
      });

      document.querySelectorAll('[data-settings-href]').forEach((el) => {
        const key = el.getAttribute('data-settings-href');
        const value = settings[key];
        const hideIfEmpty = el.hasAttribute('data-hide-if-empty');

        if (!value) {
          if (hideIfEmpty) el.style.display = 'none';
          return;
        }
        const prefix = el.getAttribute('data-href-prefix') || '';
        el.setAttribute('href', prefix + value);
      });

      return settings;
    } catch (err) {
      console.error('Failed to load settings:', err);
      return {};
    }
  }

  // ---- Skills grid ----
  async function renderSkills() {
    const grid = document.querySelector('[data-skills-grid]');
    if (!grid) return;

    try {
      const { skillCategories } = await api.getSkills();

      if (!skillCategories.length) {
        grid.innerHTML = `<div class="empty-state"><h3>Skills coming soon</h3><p>Add skill categories from the admin dashboard.</p></div>`;
        return;
      }

      grid.innerHTML = skillCategories.map((cat) => `
        <div class="card card--hover skill-card" data-reveal>
          <div class="skill-card__head">
            <div class="skill-card__icon">${iconSvg(cat.icon)}</div>
            <div class="skill-card__title">${esc(cat.name)}</div>
          </div>
          <div class="skill-card__list">
            ${cat.skills.map((s) => `
              <div class="skill-row">
                <div class="skill-row__top">
                  <span class="skill-row__name">${esc(s.name)}</span>
                  ${s.proficiency ? `<span class="skill-row__pct">${s.proficiency}%</span>` : ''}
                </div>
                <div class="skill-row__bar">
                  <div class="skill-row__fill" style="width:${s.proficiency || 70}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');

      // Animate bars in when visible
      const bars = grid.querySelectorAll('.skill-row__fill');
      if ('IntersectionObserver' in window) {
        const obs = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              obs.unobserve(entry.target);
            }
          });
        }, { threshold: 0.3 });
        bars.forEach((b) => obs.observe(b));
      } else {
        bars.forEach((b) => b.classList.add('is-visible'));
      }

      observeReveals();
      return skillCategories.length;
    } catch (err) {
      console.error('Failed to load skills:', err);
      grid.innerHTML = `<div class="empty-state"><h3>Couldn't load skills</h3><p>Please try refreshing the page.</p></div>`;
      return 0;
    }
  }

  // ---- Featured projects ----
  function projectCardHtml(p) {
    const techChips = (p.technologies || []).slice(0, 4)
      .map((t) => `<span class="badge">${esc(t.name)}</span>`).join('');

    const thumb = p.thumbnail_path
      ? `<img src="${esc(p.thumbnail_path)}" alt="${esc(p.title)} thumbnail" loading="lazy">`
      : `<div class="project-card__thumb-placeholder"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg></div>`;

    return `
      <a href="/project/${esc(p.slug)}" class="card card--hover project-card" data-reveal>
        <div class="project-card__thumb">
          ${thumb}
          ${p.category ? `<span class="project-card__category">${esc(p.category)}</span>` : ''}
        </div>
        <div class="project-card__body">
          <h3 class="project-card__title">${esc(p.title)}</h3>
          <p class="project-card__desc">${esc(p.short_description)}</p>
          <div class="project-card__tags">${techChips}</div>
          <div class="project-card__footer">
            <span class="btn btn--ghost btn--sm" style="padding-left:0;">View Project →</span>
          </div>
        </div>
      </a>
    `;
  }

  async function renderFeaturedProjects() {
    const grid = document.querySelector('[data-featured-projects]');
    if (!grid) return;

    try {
      const { projects } = await api.getFeaturedProjects(6);

      if (!projects.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><h3>Projects coming soon</h3><p>Featured projects published from the admin dashboard will appear here.</p></div>`;
        return 0;
      }

      grid.innerHTML = projects.map(projectCardHtml).join('');
      observeReveals();
      return projects.length;
    } catch (err) {
      console.error('Failed to load featured projects:', err);
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><h3>Couldn't load projects</h3><p>Please try refreshing the page.</p></div>`;
      return 0;
    }
  }

  // ---- Certifications ----
  async function renderCertifications() {
    const grid = document.querySelector('[data-certifications]');
    if (!grid) return 0;

    try {
      const { certificates } = await api.getCertificates();

      if (!certificates.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><h3>No certifications yet</h3><p>Add certificates from the admin dashboard.</p></div>`;
        return 0;
      }

      grid.innerHTML = certificates.map((c) => `
        <div class="card cert-card" data-reveal>
          <div class="cert-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M9 13l-2 8 5-3 5 3-2-8"/></svg>
          </div>
          <div>
            <div class="cert-card__title">${esc(c.title)}</div>
            <div class="cert-card__issuer">${esc(c.issuer)}</div>
            <div class="cert-card__meta">
              ${c.issue_date ? `<span class="cert-card__date">${esc(c.issue_date)}</span>` : ''}
              ${c.credential_url ? `<a class="cert-card__link" href="${esc(c.credential_url)}" target="_blank" rel="noopener noreferrer">Verify ↗</a>` : ''}
            </div>
          </div>
        </div>
      `).join('');

      observeReveals();
      return certificates.length;
    } catch (err) {
      console.error('Failed to load certificates:', err);
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><h3>Couldn't load certifications</h3><p>Please try refreshing the page.</p></div>`;
      return 0;
    }
  }

  // ---- Timeline (from settings.timeline.items, JSON string) ----
  function renderTimeline(settings) {
    const wrap = document.querySelector('[data-timeline]');
    if (!wrap) return;

    let items = [];
    try {
      items = JSON.parse(settings['timeline.items'] || '[]');
    } catch {
      items = [];
    }

    if (!items.length) {
      wrap.innerHTML = `<div class="empty-state"><h3>Timeline coming soon</h3><p>Milestones will appear here once added.</p></div>`;
      return;
    }

    wrap.innerHTML = items.map((item, i) => `
      <div class="timeline-item" data-reveal data-reveal-delay="${Math.min(i, 5)}">
        <div class="timeline-item__year">${esc(item.year)}</div>
        <div class="timeline-item__dot"></div>
        <div class="timeline-item__content">
          <span class="timeline-item__category">${esc(item.category)}</span>
          <h3 class="timeline-item__title">${esc(item.title)}</h3>
          <p class="timeline-item__desc">${esc(item.description)}</p>
        </div>
      </div>
    `).join('');

    observeReveals();
  }

  // ---- Stats (derived from real counts, not hardcoded) ----
  async function renderStats(skillCount, projectsTotal, certsCount) {
    try {
      const { categories } = await api.getCategories();
      const setStat = (key, value) => {
        const el = document.querySelector(`[data-stat="${key}"] .stat-card__value`);
        if (el) el.textContent = value;
      };
      setStat('projects', `${projectsTotal}+`);
      setStat('domains', categories.length);
      setStat('skills', skillCount);
      setStat('certs', certsCount);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  // Re-run scroll-reveal observer for newly injected nodes
  function observeReveals() {
    const els = document.querySelectorAll('[data-reveal]:not(.is-visible)');
    if (!els.length || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el) => obs.observe(el));
  }

  // ---- Boot ----
  (async function init() {
    const [settings, skillCount, certsCount] = await Promise.all([
      applySettings(),
      renderSkills(),
      renderCertifications(),
    ]);

    const projectsResult = await api.getProjects({ page: 1, limit: 1 }).catch(() => null);
    const projectsTotal = projectsResult?.pagination?.total ?? 0;

    await renderFeaturedProjects();
    renderTimeline(settings);
    renderStats(skillCount || 0, projectsTotal, certsCount || 0);
  })();
})();
