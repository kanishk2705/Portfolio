// assets/js/editor.js
// ---------------------------------------------------------------
// Lightweight rich-text editor. No external dependencies.
// Uses contenteditable + execCommand (deprecated but universally
// supported and perfectly fine for a single-admin CMS).
//
// Public API (window.Editor):
//   Editor.create(containerEl, { placeholder, initialHtml })
//     → returns an editorInstance with:
//         .getHtml()   → sanitised HTML string
//         .setHtml(h)  → programmatic content set
//         .focus()
//         .destroy()
//
// Usage in admin-dashboard.js:
//   const ed = Editor.create(document.getElementById('pf-overview-wrap'), {
//     placeholder: 'Write overview here…',
//     initialHtml: project.overview || '',
//   });
//   ...
//   const html = ed.getHtml();
// ---------------------------------------------------------------
'use strict';

(function () {

  // ---- Icons (inline SVG strings) ----
  const I = {
    bold:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 4h8a4 4 0 010 8H6z"/><path d="M6 12h9a4 4 0 010 8H6z"/></svg>`,
    italic:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>`,
    h2:         `<span style="font-weight:700;font-size:11px;line-height:1;">H2</span>`,
    h3:         `<span style="font-weight:700;font-size:11px;line-height:1;">H3</span>`,
    ul:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></svg>`,
    ol:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4" stroke="currentColor"/><path d="M4 10h2" stroke="currentColor"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" stroke="currentColor"/></svg>`,
    link:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`,
    code:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    quote:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>`,
    clear:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  };

  const TOOLBAR_BUTTONS = [
    { cmd: 'bold',           icon: I.bold,     title: 'Bold (Ctrl+B)' },
    { cmd: 'italic',         icon: I.italic,   title: 'Italic (Ctrl+I)' },
    { divider: true },
    { cmd: 'h2',             icon: I.h2,       title: 'Heading 2' },
    { cmd: 'h3',             icon: I.h3,       title: 'Heading 3' },
    { divider: true },
    { cmd: 'insertUnorderedList', icon: I.ul,  title: 'Bullet list' },
    { cmd: 'insertOrderedList',   icon: I.ol,  title: 'Numbered list' },
    { divider: true },
    { cmd: 'link',           icon: I.link,     title: 'Insert link (Ctrl+K)' },
    { cmd: 'code',           icon: I.code,     title: 'Inline code' },
    { cmd: 'blockquote',     icon: I.quote,    title: 'Quote' },
    { divider: true },
    { cmd: 'removeFormat',   icon: I.clear,    title: 'Clear formatting' },
  ];

  function createEditor(container, { placeholder = '', initialHtml = '' } = {}) {
    // Build DOM
    container.innerHTML = `
      <div class="rte-wrap">
        <div class="rte-toolbar"></div>
        <div class="rte-content" contenteditable="true" spellcheck="true" data-placeholder="${placeholder}"></div>
      </div>
      <div class="rte-link-popup" id="rte-link-${Date.now()}">
        <input type="url" placeholder="https://…">
        <button class="btn btn--primary btn--sm" id="rte-link-ok">OK</button>
        <button class="btn btn--ghost btn--sm" id="rte-link-cancel">✕</button>
      </div>
    `;

    const toolbar   = container.querySelector('.rte-toolbar');
    const content   = container.querySelector('.rte-content');
    const linkPopup = container.querySelector('.rte-link-popup');
    const linkInput = linkPopup.querySelector('input');

    let savedRange = null;

    // Build toolbar
    TOOLBAR_BUTTONS.forEach(({ cmd, icon, title, divider }) => {
      if (divider) {
        const d = document.createElement('div');
        d.className = 'rte-divider';
        toolbar.appendChild(d);
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rte-btn';
      btn.title = title;
      btn.dataset.cmd = cmd;
      btn.innerHTML = icon;
      toolbar.appendChild(btn);
    });

    // Set initial content
    if (initialHtml) content.innerHTML = initialHtml;

    // ---- execCommand helpers ----
    function exec(cmd, value = null) {
      content.focus();
      if (value !== null) {
        document.execCommand(cmd, false, value);
      } else {
        document.execCommand(cmd, false, null);
      }
      updateActiveStates();
    }

    function execBlock(tag) {
      content.focus();
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const block = document.createElement(tag);
      // Wrap selected content
      try {
        block.appendChild(range.extractContents());
        range.insertNode(block);
        range.selectNodeContents(block);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {
        document.execCommand('formatBlock', false, `<${tag}>`);
      }
      updateActiveStates();
    }

    // ---- Toolbar button click handling ----
    toolbar.addEventListener('mousedown', (e) => {
      // Prevent focus loss from content area
      e.preventDefault();
      const btn = e.target.closest('.rte-btn');
      if (!btn) return;
      const cmd = btn.dataset.cmd;

      if (cmd === 'link') {
        openLinkPopup();
        return;
      }
      if (cmd === 'h2') { execBlock('h2'); return; }
      if (cmd === 'h3') { execBlock('h3'); return; }
      if (cmd === 'code') {
        // Toggle inline code span
        const sel = window.getSelection();
        if (sel && sel.rangeCount && !sel.isCollapsed) {
          const text = sel.toString();
          exec('insertHTML', `<code>${text}</code>`);
        }
        return;
      }
      if (cmd === 'blockquote') { execBlock('blockquote'); return; }

      exec(cmd);
    });

    // ---- Link popup ----
    function saveSelection() {
      const sel = window.getSelection();
      savedRange = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    }

    function restoreSelection() {
      if (!savedRange) return;
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }

    function openLinkPopup() {
      saveSelection();
      const sel = window.getSelection();
      const rect = sel && sel.rangeCount
        ? sel.getRangeAt(0).getBoundingClientRect()
        : container.getBoundingClientRect();

      linkPopup.style.top  = `${rect.bottom + window.scrollY + 6}px`;
      linkPopup.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;
      linkPopup.classList.add('is-open');
      linkInput.value = '';
      linkInput.focus();
    }

    function closeLinkPopup() {
      linkPopup.classList.remove('is-open');
      content.focus();
    }

    linkPopup.querySelector('#rte-link-ok').addEventListener('click', () => {
      const url = linkInput.value.trim();
      if (url) {
        restoreSelection();
        exec('createLink', url);
        // Make all inserted links open in new tab
        content.querySelectorAll('a').forEach((a) => {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        });
      }
      closeLinkPopup();
    });

    linkPopup.querySelector('#rte-link-cancel').addEventListener('click', closeLinkPopup);
    linkInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { linkPopup.querySelector('#rte-link-ok').click(); }
      if (e.key === 'Escape') { closeLinkPopup(); }
    });

    // ---- Keyboard shortcuts ----
    content.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'b') { e.preventDefault(); exec('bold'); }
      if (mod && e.key === 'i') { e.preventDefault(); exec('italic'); }
      if (mod && e.key === 'k') { e.preventDefault(); openLinkPopup(); }
      // Tab → indent inside list, else insert spaces
      if (e.key === 'Tab') {
        e.preventDefault();
        if (document.queryCommandState('insertUnorderedList') ||
            document.queryCommandState('insertOrderedList')) {
          exec(e.shiftKey ? 'outdent' : 'indent');
        } else {
          exec('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;');
        }
      }
    });

    // ---- Active state tracking ----
    function updateActiveStates() {
      toolbar.querySelectorAll('.rte-btn').forEach((btn) => {
        const cmd = btn.dataset.cmd;
        if (['bold','italic','insertUnorderedList','insertOrderedList'].includes(cmd)) {
          btn.classList.toggle('is-active', document.queryCommandState(cmd));
        }
      });
    }

    content.addEventListener('keyup', updateActiveStates);
    content.addEventListener('mouseup', updateActiveStates);
    content.addEventListener('selectionchange', updateActiveStates);
    document.addEventListener('selectionchange', () => {
      if (container.contains(document.activeElement)) updateActiveStates();
    });

    // ---- Public API ----
    return {
      getHtml() {
        // Normalise empty paragraphs and return innerHTML
        const html = content.innerHTML
          .replace(/<p><br><\/p>/g, '')
          .replace(/<br\s*\/?>\s*<br\s*\/?>/g, '</p><p>')
          .trim();
        return html;
      },
      setHtml(html) {
        content.innerHTML = html || '';
      },
      focus() {
        content.focus();
      },
      destroy() {
        linkPopup.remove();
        container.innerHTML = '';
      },
    };
  }

  window.Editor = { create: createEditor };
})();
