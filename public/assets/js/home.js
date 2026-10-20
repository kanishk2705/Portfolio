// assets/js/home.js
// ---------------------------------------------------------------
// Renders all dynamic sections of the homepage:
//   research interests, featured projects, education + experience,
//   skills grid, timeline, certifications, stats
// ---------------------------------------------------------------
'use strict';

(function () {
  const { esc, projectCard } = window.Portfolio;

  // "line one\nline two" → <ul> of bullets (blank lines ignored)
  function bulletList(text) {
    const items = String(text || '').split(/\r?\n/).map((l) => l.replace(/^[\s•*-]+/, '').trim()).filter(Boolean);
    return items.length ? `<ul class="background-item__list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
  }

  const dateRange = (start, end) => [start, end].filter(Boolean).join(' – ');

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

  // ---- Settings (text and links are rendered on the server; the
  // timeline is a JSON setting rendered here) ----
  async function loadSettings() {
    try {
      const { settings } = await api.getPublicSettings();
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
        document.getElementById('skills')?.remove();
        return 0;
      }

      // Skills are listed as chips — no self-rated percentages
      grid.innerHTML = skillCategories.filter((cat) => cat.skills.length).map((cat) => `
        <div class="card card--hover skill-card" data-reveal>
          <div class="skill-card__head">
            <div class="skill-card__icon">${iconSvg(cat.icon)}</div>
            <div class="skill-card__title">${esc(cat.name)}</div>
          </div>
          <div class="skill-card__chips">
            ${cat.skills.map((s) => `<span class="badge">${esc(s.name)}</span>`).join('')}
          </div>
        </div>
      `).join('');

      observeReveals();
      return skillCategories.length;
    } catch (err) {
      console.error('Failed to load skills:', err);
      grid.innerHTML = `<div class="empty-state"><h3>Couldn't load skills</h3><p>Please try refreshing the page.</p></div>`;
      return 0;
    }
  }

  // ---- Research interests (settings research.items, JSON) ----
  function renderResearch(settings) {
    const grid = document.querySelector('[data-research]');
    if (!grid) return;
    let items = [];
    try { items = JSON.parse(settings['research.items'] || '[]'); } catch { items = []; }

    grid.innerHTML = items.map((item, i) => `
      <div class="card research-card" data-reveal data-reveal-delay="${Math.min(i, 5)}">
        <span class="research-card__index">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="research-card__title">${esc(item.title)}</h3>
        ${item.description ? `<p class="research-card__desc">${esc(item.description)}</p>` : ''}
      </div>
    `).join('');
    observeReveals();
  }

  // ---- Education + experience ----
  async function renderBackground() {
    const wrap = document.querySelector('[data-background]');
    if (!wrap) return;

    try {
      const [{ items: education }, { items: experience }] = await Promise.all([api.getEducation(), api.getExperience()]);

      const fill = (col, items, itemHtml) => {
        const el = wrap.querySelector(col);
        if (!items.length) return;
        el.hidden = false;
        el.querySelector('.background-list').innerHTML = items.map(itemHtml).join('');
      };

      fill('[data-education]', education, (e) => `
        <div class="card background-item" data-reveal>
          <div class="background-item__top">
            <h4 class="background-item__title">${esc(e.degree)}</h4>
            ${dateRange(e.start_label, e.end_label) ? `<span class="background-item__date">${esc(dateRange(e.start_label, e.end_label))}</span>` : ''}
          </div>
          <div class="background-item__org">${esc(e.institution)}${e.location ? ` · ${esc(e.location)}` : ''}</div>
          ${e.grade ? `<div class="background-item__meta">${esc(e.grade)}</div>` : ''}
          ${bulletList(e.highlights)}
        </div>
      `);

      fill('[data-experience]', experience, (x) => `
        <div class="card background-item" data-reveal>
          <div class="background-item__top">
            <h4 class="background-item__title">${esc(x.role)}</h4>
            ${dateRange(x.start_label, x.end_label) ? `<span class="background-item__date">${esc(dateRange(x.start_label, x.end_label))}</span>` : ''}
          </div>
          <div class="background-item__org">
            ${x.organization_url
              ? `<a href="${esc(x.organization_url)}" target="_blank" rel="noopener noreferrer">${esc(x.organization)}</a>`
              : esc(x.organization)}${x.location ? ` · ${esc(x.location)}` : ''}
          </div>
          ${x.employment_type ? `<span class="badge">${esc(x.employment_type)}</span>` : ''}
          ${bulletList(x.highlights)}
        </div>
      `);

      // One column of content → let it use the full width
      wrap.classList.toggle('background-grid--single', !education.length || !experience.length);
      observeReveals();
    } catch (err) {
      console.error('Failed to load education/experience:', err);
    }
  }

  // ---- Featured projects ----
  async function renderFeaturedProjects() {
    const grid = document.querySelector('[data-featured-projects]');
    if (!grid) return;

    try {
      const { projects } = await api.getFeaturedProjects(6);

      if (!projects.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><h3>Projects coming soon</h3><p>Project write-ups are on their way. Meanwhile, see my work on GitHub.</p></div>`;
        return 0;
      }

      grid.innerHTML = projects.map((p) => projectCard(p, { reveal: true })).join('');
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
        document.getElementById('certifications')?.remove();
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
      document.getElementById('timeline')?.remove();
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
      setStat('projects', projectsTotal);
      // Only domains that actually have published work
      setStat('domains', categories.filter((c) => c.project_count > 0).length);
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
      loadSettings(),
      renderSkills(),
      renderCertifications(),
      renderBackground(),
    ]);

    const projectsResult = await api.getProjects({ page: 1, limit: 1 }).catch(() => null);
    const projectsTotal = projectsResult?.pagination?.total ?? 0;

    renderResearch(settings);
    await renderFeaturedProjects();
    renderTimeline(settings);
    renderStats(skillCount || 0, projectsTotal, certsCount || 0);
  })();
})();
