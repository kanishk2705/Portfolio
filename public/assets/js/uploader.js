// assets/js/uploader.js
// ---------------------------------------------------------------
// Reusable upload module used by the admin drawer Media tab.
//
// Public API (window.Uploader):
//   Uploader.singleImage(zoneEl, opts)  → { getPath(), setPath(p), clear() }
//   Uploader.gallery(gridEl, opts)      → { getPaths(), addPath(p) }
//   Uploader.video(containerEl, opts)   → { getVideos() }
//   Uploader.document(listEl, opts)     → { getDocs() }
//
// All upload calls go to /api/admin/upload/* which is wired in
// Phase 3 (upload.routes.js + uploadController.js).
// ---------------------------------------------------------------
'use strict';

(function () {

  function getCsrf() {
    const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // Upload a single file to a given endpoint and return { filePath }
  async function uploadFile(endpoint, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('file', file);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && data.success) {
            resolve(data);
          } else {
            reject(new Error(data.message || `Upload failed (${xhr.status})`));
          }
        } catch {
          reject(new Error('Unexpected server response.'));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')));

      xhr.open('POST', endpoint);
      xhr.setRequestHeader('X-CSRF-Token', getCsrf());
      xhr.send(form);
    });
  }

  // ---- Wire drag-and-drop on a zone element ----
  function wireDrop(zone, onFiles) {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('is-dragover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('is-dragover');
      const files = e.dataTransfer?.files;
      if (files?.length) onFiles(Array.from(files));
    });
  }

  // ================================================================
  // SINGLE IMAGE UPLOAD (thumbnail, banner, architecture, workflow)
  // ================================================================
  function singleImage(containerEl, { label, hint, endpoint = '/api/admin/upload/image', type = 'gallery', projectId = null, initialPath = null } = {}) {
    let currentPath = initialPath || null;

    containerEl.innerHTML = `
      <div class="upload-zone" id="uz-${type}">
        <input type="file" accept="image/*" id="uz-file-${type}" tabindex="-1">
        <div class="upload-zone__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </div>
        <div class="upload-zone__text">Drop image here or click to browse</div>
        <div class="upload-zone__sub">${hint || 'PNG, JPG, WebP · max 8 MB'}</div>
      </div>
      <div class="upload-progress" id="uprog-${type}">
        <div class="upload-progress__bar" id="ubar-${type}"></div>
      </div>
      <div id="uprev-${type}"></div>
    `;

    const zone    = containerEl.querySelector(`#uz-${type}`);
    const fileIn  = containerEl.querySelector(`#uz-file-${type}`);
    const progWrap = containerEl.querySelector(`#uprog-${type}`);
    const bar     = containerEl.querySelector(`#ubar-${type}`);
    const prevEl  = containerEl.querySelector(`#uprev-${type}`);

    if (initialPath) renderPreview(initialPath);

    function renderPreview(path) {
      prevEl.innerHTML = `
        <div class="upload-preview">
          <img src="${esc(path)}" alt="Preview">
          <div class="upload-preview__name">
            <span>${esc(path.split('/').pop())}</span>
            <button class="upload-preview__remove" id="urem-${type}">Remove</button>
          </div>
        </div>
      `;
      prevEl.querySelector(`#urem-${type}`).addEventListener('click', () => {
        currentPath = null;
        prevEl.innerHTML = '';
      });
    }

    async function handleFiles(files) {
      const file = files[0];
      if (!file) return;

      progWrap.classList.add('is-active');
      bar.style.width = '0%';

      try {
        const res = await uploadFile(endpoint, file, (pct) => {
          bar.style.width = `${pct}%`;
        });
        currentPath = res.filePath;
        renderPreview(currentPath);
      } catch (err) {
        if (window.showToast) showToast(`Upload failed: ${err.message}`, 'error');
        else alert(`Upload failed: ${err.message}`);
      } finally {
        progWrap.classList.remove('is-active');
        bar.style.width = '0%';
      }
    }

    fileIn.addEventListener('change', () => {
      if (fileIn.files.length) handleFiles(Array.from(fileIn.files));
    });

    wireDrop(zone, handleFiles);

    return {
      getPath() { return currentPath; },
      setPath(p) { currentPath = p; if (p) renderPreview(p); else prevEl.innerHTML = ''; },
      clear()    { currentPath = null; prevEl.innerHTML = ''; },
    };
  }

  // ================================================================
  // GALLERY (multiple images)
  // ================================================================
  function gallery(containerEl, { projectId = null, initialImages = [] } = {}) {
    const paths = [...(initialImages || []).map(img => img.file_path || img)];

    containerEl.innerHTML = `
      <div class="upload-zone" id="uz-gallery">
        <input type="file" accept="image/*" multiple id="uz-file-gallery" tabindex="-1">
        <div class="upload-zone__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </div>
        <div class="upload-zone__text">Drop images or click to add to gallery</div>
        <div class="upload-zone__sub">Multiple images supported · PNG, JPG, WebP</div>
      </div>
      <div class="upload-progress" id="uprog-gallery">
        <div class="upload-progress__bar" id="ubar-gallery"></div>
      </div>
      <div class="gallery-upload-grid" id="gallery-grid"></div>
    `;

    const zone     = containerEl.querySelector('#uz-gallery');
    const fileIn   = containerEl.querySelector('#uz-file-gallery');
    const progWrap = containerEl.querySelector('#uprog-gallery');
    const bar      = containerEl.querySelector('#ubar-gallery');
    const grid     = containerEl.querySelector('#gallery-grid');

    function renderGrid() {
      grid.innerHTML = paths.map((p, i) => `
        <div class="gallery-upload-item" data-idx="${i}">
          <img src="${esc(p)}" alt="Gallery image ${i+1}">
          <div class="gallery-upload-item__remove" data-idx="${i}">✕</div>
        </div>
      `).join('');

      grid.querySelectorAll('.gallery-upload-item__remove').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.idx, 10);
          paths.splice(idx, 1);
          renderGrid();
        });
      });
    }

    if (paths.length) renderGrid();

    async function handleFiles(files) {
      progWrap.classList.add('is-active');
      bar.style.width = '0%';

      let done = 0;
      const total = files.length;

      for (const file of files) {
        try {
          const res = await uploadFile('/api/admin/upload/image', file, (pct) => {
            bar.style.width = `${Math.round(((done * 100) + pct) / total)}%`;
          });
          paths.push(res.filePath);
          done++;
        } catch (err) {
          if (window.showToast) showToast(`Upload failed: ${err.message}`, 'error');
        }
      }

      renderGrid();
      progWrap.classList.remove('is-active');
      bar.style.width = '0%';
    }

    fileIn.addEventListener('change', () => {
      if (fileIn.files.length) handleFiles(Array.from(fileIn.files));
    });

    wireDrop(zone, handleFiles);

    return {
      getPaths() { return [...paths]; },
      addPath(p) { paths.push(p); renderGrid(); },
    };
  }

  // ================================================================
  // VIDEO (file upload OR external URL)
  // ================================================================
  function video(containerEl, { projectId = null, initialVideos = [] } = {}) {
    const videos = [...(initialVideos || [])];

    containerEl.innerHTML = `
      <div class="upload-zone" id="uz-video" style="margin-bottom:var(--space-3);">
        <input type="file" accept="video/*" id="uz-file-video" tabindex="-1">
        <div class="upload-zone__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
        </div>
        <div class="upload-zone__text">Drop video file or click to upload</div>
        <div class="upload-zone__sub">MP4, WebM · max 200 MB</div>
      </div>

      <div class="upload-progress" id="uprog-video">
        <div class="upload-progress__bar" id="ubar-video"></div>
      </div>

      <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:var(--space-2);text-align:center;">or paste an external URL</div>
      <div class="external-video-input">
        <input class="form-input" id="ext-video-url" type="url" placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…">
        <button class="btn btn--secondary btn--sm" id="ext-video-add">Add</button>
      </div>

      <div class="doc-upload-list" id="video-list"></div>
    `;

    const zone      = containerEl.querySelector('#uz-video');
    const fileIn    = containerEl.querySelector('#uz-file-video');
    const progWrap  = containerEl.querySelector('#uprog-video');
    const bar       = containerEl.querySelector('#ubar-video');
    const extUrlIn  = containerEl.querySelector('#ext-video-url');
    const extAddBtn = containerEl.querySelector('#ext-video-add');
    const listEl    = containerEl.querySelector('#video-list');

    function renderList() {
      listEl.innerHTML = videos.map((v, i) => `
        <div class="doc-upload-item" data-idx="${i}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          <span class="doc-upload-item__name">${esc(v.title || v.external_url || v.file_path || 'Video')}</span>
          <span class="doc-upload-item__type" style="font-size:10px;font-family:var(--font-mono);color:var(--text-tertiary);margin-right:var(--space-2);">${v.source_type}</span>
          <button class="doc-upload-item__remove" data-idx="${i}">Remove</button>
        </div>
      `).join('');

      listEl.querySelectorAll('.doc-upload-item__remove').forEach((btn) => {
        btn.addEventListener('click', () => {
          videos.splice(parseInt(btn.dataset.idx, 10), 1);
          renderList();
        });
      });
    }

    if (videos.length) renderList();

    async function handleFile(file) {
      progWrap.classList.add('is-active');
      bar.style.width = '0%';
      try {
        const res = await uploadFile('/api/admin/upload/video', file, (pct) => {
          bar.style.width = `${pct}%`;
        });
        videos.push({ source_type: 'upload', file_path: res.filePath, title: file.name });
        renderList();
      } catch (err) {
        if (window.showToast) showToast(`Upload failed: ${err.message}`, 'error');
      } finally {
        progWrap.classList.remove('is-active');
        bar.style.width = '0%';
      }
    }

    fileIn.addEventListener('change', () => {
      if (fileIn.files[0]) handleFile(fileIn.files[0]);
    });

    wireDrop(zone, (files) => { if (files[0]) handleFile(files[0]); });

    extAddBtn.addEventListener('click', () => {
      const url = extUrlIn.value.trim();
      if (!url) return;
      videos.push({ source_type: 'external', external_url: url, title: url });
      extUrlIn.value = '';
      renderList();
    });

    extUrlIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') extAddBtn.click(); });

    return { getVideos() { return [...videos]; } };
  }

  // ================================================================
  // DOCUMENTS (PDF upload)
  // ================================================================
  function document_(containerEl, { initialDocs = [] } = {}) {
    const docs = [...(initialDocs || [])];

    containerEl.innerHTML = `
      <div class="upload-zone" id="uz-doc">
        <input type="file" accept=".pdf,.doc,.docx" id="uz-file-doc" tabindex="-1">
        <div class="upload-zone__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="upload-zone__text">Drop PDF or click to upload</div>
        <div class="upload-zone__sub">PDF, Word · max 20 MB</div>
      </div>
      <div class="upload-progress" id="uprog-doc">
        <div class="upload-progress__bar" id="ubar-doc"></div>
      </div>
      <div class="doc-upload-list" id="doc-list"></div>
    `;

    const zone     = containerEl.querySelector('#uz-doc');
    const fileIn   = containerEl.querySelector('#uz-file-doc');
    const progWrap = containerEl.querySelector('#uprog-doc');
    const bar      = containerEl.querySelector('#ubar-doc');
    const listEl   = containerEl.querySelector('#doc-list');

    function renderList() {
      listEl.innerHTML = docs.map((d, i) => `
        <div class="doc-upload-item" data-idx="${i}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span class="doc-upload-item__name">${esc(d.label || d.file_path || 'Document')}</span>
          <button class="doc-upload-item__remove" data-idx="${i}">Remove</button>
        </div>
      `).join('');

      listEl.querySelectorAll('.doc-upload-item__remove').forEach((btn) => {
        btn.addEventListener('click', () => {
          docs.splice(parseInt(btn.dataset.idx, 10), 1);
          renderList();
        });
      });
    }

    if (docs.length) renderList();

    async function handleFile(file) {
      progWrap.classList.add('is-active');
      bar.style.width = '0%';
      try {
        const res = await uploadFile('/api/admin/upload/document', file, (pct) => {
          bar.style.width = `${pct}%`;
        });
        const label = file.name.replace(/\.[^.]+$/, '');
        docs.push({ file_path: res.filePath, label });
        renderList();
      } catch (err) {
        if (window.showToast) showToast(`Upload failed: ${err.message}`, 'error');
      } finally {
        progWrap.classList.remove('is-active');
        bar.style.width = '0%';
      }
    }

    fileIn.addEventListener('change', () => {
      if (fileIn.files[0]) handleFile(fileIn.files[0]);
    });

    wireDrop(zone, (files) => { if (files[0]) handleFile(files[0]); });

    return { getDocs() { return [...docs]; } };
  }

  window.Uploader = {
    singleImage,
    gallery,
    video,
    document: document_,
  };
})();
