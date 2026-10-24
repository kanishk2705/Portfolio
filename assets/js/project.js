// assets/js/project.js
// ---------------------------------------------------------------
// Renders the dynamic Project Detail page (/project/:slug).
// Every content block is conditional — only fields that actually
// have data render a section, so sparse projects don't show empty
// headers.
// ---------------------------------------------------------------
'use strict';

(function () {
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getSlugFromUrl() {
    const match = window.location.pathname.match(/\/project\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setState(state) {
    document.getElementById('loading-state').style.display   = state === 'loading'   ? 'block' : 'none';
    document.getElementById('not-found-state').style.display = state === 'not-found' ? 'block' : 'none';
    document.getElementById('project-root').style.display    = state === 'ready'     ? 'block' : 'none';
  }

  // ---- Icons ----
  const ICON = {
    github: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-2.17c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.95.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 015.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.67.42.36.78 1.07.78 2.16v3.2c0 .31.21.66.79.55A10.52 10.52 0 0023.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>',
    demo:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    paper:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    doc:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  };

  // ---- Banner ----
  function renderBanner(p) {
    document.getElementById('breadcrumb-title').textContent = p.title;

    const catEl = document.getElementById('banner-category');
    if (p.category) {
      catEl.textContent = p.category;
      catEl.style.display = 'inline-flex';
    } else {
      catEl.style.display = 'none';
    }
    document.getElementById('banner-status').innerHTML = Portfolio.statusBadge(p);

    document.getElementById('banner-title').textContent = p.title;
    document.getElementById('banner-desc').textContent = p.short_description;

    // Action buttons
    const actions = [];
    if (p.demo_url) actions.push(`<a href="${esc(p.demo_url)}" target="_blank" rel="noopener noreferrer" class="btn btn--primary">${ICON.demo} Live Demo</a>`);
    if (p.github_url) actions.push(`<a href="${esc(p.github_url)}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary">${ICON.github} View Code</a>`);
    if (p.research_paper_url) actions.push(`<a href="${esc(p.research_paper_url)}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary">${ICON.paper} Research Paper</a>`);
    document.getElementById('banner-actions').innerHTML = actions.join('');

    // Tags
    const tagsEl = document.getElementById('banner-tags');
    if (p.tags && p.tags.length) {
      tagsEl.innerHTML = p.tags.map((t) => `<span class="badge">${esc(t.name)}</span>`).join('');
    }

    // Hero banner image
    if (p.banner_path) {
      document.getElementById('banner-hero-img').style.display = 'block';
      const img = document.getElementById('banner-hero-img-el');
      img.src = p.banner_path;
      img.alt = `${p.title} banner`;
    }
  }

  // ---- Content block helper ----
  function block(content, contentEl) {
    contentEl.insertAdjacentHTML('beforeend', content);
  }

  function richTextBlock(title, html) {
    if (!html || !html.trim()) return '';
    return `
      <div class="content-block">
        <h2>${esc(title)}</h2>
        <div class="rich-content">${html}</div>
      </div>`;
  }

  function diagramBlock(title, src) {
    if (!src) return '';
    return `
      <div class="content-block">
        <h2>${esc(title)}</h2>
        <div class="gallery-item" style="aspect-ratio: 16/9; cursor: zoom-in;" data-lightbox-src="${esc(src)}">
          <img src="${esc(src)}" alt="${esc(title)}" loading="lazy">
        </div>
      </div>`;
  }

  function metricsBlock(metrics) {
    if (!metrics || !metrics.length) return '';
    return `
      <div class="metrics-grid" style="margin-top: var(--space-6);">
        ${metrics.map((m) => `
          <div class="card metric-card">
            <div class="metric-card__value">${esc(m.metric_value)}</div>
            <div class="metric-card__label">${esc(m.metric_label)}</div>
          </div>
        `).join('')}
      </div>`;
  }

  function galleryBlock(images) {
    if (!images || !images.length) return '';
    return `
      <div class="content-block">
        <h2>Gallery</h2>
        <div class="gallery-grid">
          ${images.map((img) => `
            <div class="gallery-item" data-lightbox-src="${esc(img.file_path)}">
              <img src="${esc(img.file_path)}" alt="${esc(img.alt_text || '')}" loading="lazy">
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  function videosBlock(videos) {
    if (!videos || !videos.length) return '';
    return `
      <div class="content-block">
        <h2>Video Demo</h2>
        <div class="media-list">
          ${videos.map((v) => {
            if (v.source_type === 'upload') {
              return `<div class="video-embed"><video controls src="${esc(v.file_path)}"></video></div>`;
            }
            const embedUrl = toEmbedUrl(v.external_url);
            return `<div class="video-embed"><iframe src="${esc(embedUrl)}" allowfullscreen loading="lazy"></iframe></div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function toEmbedUrl(url) {
    const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]+)/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vimeo = url.match(/vimeo\.com\/(\d+)/);
    if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
    return url;
  }

  function timelineBlock(events) {
    if (!events || !events.length) return '';
    return `
      <div class="content-block">
        <h2>Project Timeline</h2>
        <div class="project-timeline-list">
          ${events.map((e) => `
            <div class="project-timeline-list__item">
              <div>
                ${e.date_label ? `<div class="project-timeline-list__label">${esc(e.date_label)}</div>` : ''}
                <div style="font-weight:600; margin: 2px 0;">${esc(e.title)}</div>
                ${e.description ? `<div style="color: var(--text-secondary); font-size: var(--text-sm);">${esc(e.description)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  function documentsBlock(docs) {
    if (!docs || !docs.length) return '';
    return `
      <div class="content-block">
        <h2>Reports &amp; Documents</h2>
        <div class="media-list">
          ${docs.map((d) => `
            <a href="${esc(d.file_path)}" target="_blank" rel="noopener noreferrer" class="card doc-link">
              <div class="doc-link__icon">${ICON.doc}</div>
              <div class="doc-link__name">${esc(d.label)}</div>
              <div class="doc-link__action">Download ↓</div>
            </a>
          `).join('')}
        </div>
      </div>`;
  }

  // ---- Main content assembly ----
  function renderContent(p) {
    const contentEl = document.getElementById('project-content');
    let html = '';

    html += richTextBlock('Overview', p.overview);
    html += richTextBlock('My Role', p.my_role);
    html += richTextBlock('Problem Statement', p.problem_statement);
    html += richTextBlock('Dataset Information', p.dataset_info);
    html += richTextBlock('Methodology', p.methodology);
    html += diagramBlock('Architecture Diagram', p.architecture_diagram_path);
    html += diagramBlock('Workflow Diagram', p.workflow_diagram_path);
    html += richTextBlock('Implementation Details', p.implementation_details);

    // Results + metrics combined under one heading
    if ((p.results && p.results.trim()) || (p.metrics && p.metrics.length)) {
      html += `<div class="content-block"><h2>Results</h2>`;
      if (p.results) html += `<div class="rich-content">${p.results}</div>`;
      html += metricsBlock(p.metrics);
      html += `</div>`;
    }

    html += richTextBlock('What I Learned', p.key_learnings);
    html += galleryBlock(p.images);
    html += videosBlock(p.videos);
    html += timelineBlock(p.timeline);
    html += richTextBlock('Future Improvements', p.future_improvements);
    html += documentsBlock(p.documents);

    if (!html.trim()) {
      html = `<div class="empty-state"><h3>More details coming soon</h3><p>Full write-up for this project is in progress.</p></div>`;
    }

    contentEl.innerHTML = html;

    // Wire lightbox clicks
    contentEl.querySelectorAll('[data-lightbox-src]').forEach((el) => {
      el.addEventListener('click', () => openLightbox(el.dataset.lightboxSrc));
    });
  }

  // ---- Sidebar ----
  function renderSidebar(p) {
    const sidebar = document.getElementById('project-sidebar');
    let html = '';

    // Quick links
    const links = [];
    if (p.demo_url) links.push(['Live Demo', p.demo_url, ICON.demo]);
    if (p.github_url) links.push(['Source Code', p.github_url, ICON.github]);
    if (p.research_paper_url) links.push(['Research Paper', p.research_paper_url, ICON.paper]);

    if (links.length) {
      html += `
        <div class="card sidebar-card">
          <div class="sidebar-card__title">Links</div>
          <div class="sidebar-links">
            ${links.map(([label, url, icon]) => `
              <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="sidebar-link">${icon} ${esc(label)}</a>
            `).join('')}
          </div>
        </div>`;
    }

    // Tech stack
    if (p.technologies && p.technologies.length) {
      html += `
        <div class="card sidebar-card">
          <div class="sidebar-card__title">Technology Stack</div>
          <div class="sidebar-tech-list">
            ${p.technologies.map((t) => `<span class="badge">${esc(t.name)}</span>`).join('')}
          </div>
        </div>`;
    }

    // Project info
    const STATUS = { completed: 'Completed', ongoing: 'Ongoing', planned: 'Planned' };
    const infoRows = [];
    infoRows.push(['Status', STATUS[p.project_status] || 'Completed']);
    if (p.started_on) infoRows.push(['Started', Portfolio.formatMonth(p.started_on)]);
    if (p.project_status === 'completed' && p.completed_on) infoRows.push(['Completed', Portfolio.formatMonth(p.completed_on)]);
    if (p.category) infoRows.push(['Category', p.category]);
    if (infoRows.length) {
      html += `
        <div class="card sidebar-card">
          <div class="sidebar-card__title">Project Info</div>
          <div class="sidebar-links" style="gap: var(--space-2);">
            ${infoRows.map(([k, v]) => `
              <div style="display:flex; justify-content:space-between; font-size: var(--text-sm); padding: var(--space-2) 0; border-bottom: 1px solid var(--border-subtle);">
                <span style="color: var(--text-tertiary);">${esc(k)}</span>
                <span style="font-weight: 600;">${esc(v)}</span>
              </div>
            `).join('')}
          </div>
        </div>`;
    }

    sidebar.innerHTML = html;
  }

  // ---- Related projects ----
  function renderRelated(related) {
    if (!related || !related.length) return;
    document.getElementById('related-section').style.display = 'block';
    document.getElementById('related-grid').innerHTML = related.map((p) => Portfolio.projectCard(p)).join('');
  }

  // ---- Lightbox ----
  function openLightbox(src) {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('is-open');
    document.body.style.overflow = '';
  }
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'lightbox') closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  // ---- Boot ----
  (async function init() {
    const slug = getSlugFromUrl();
    if (!slug) { setState('not-found'); return; }

    setState('loading');

    try {
      const { project } = await api.getProjectBySlug(slug);
      renderBanner(project);
      renderContent(project);
      renderSidebar(project);
      renderRelated(project.related);
      setState('ready');
    } catch (err) {
      console.error('Failed to load project:', err);
      setState('not-found');
    }
  })();
})();
