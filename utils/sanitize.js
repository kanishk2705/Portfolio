// utils/sanitize.js
// ---------------------------------------------------------------
// Strips any HTML tags/attributes that aren't on the allowlist.
// Used to clean rich-text editor output before storing it and
// before rendering it back into project detail pages.
//
// No external library — pure regex allowlist approach.  This is
// sufficient for a single-admin system where the only source of
// HTML is an editor *you* control, but it's still good hygiene
// to prevent stored XSS if the admin endpoint were ever abused.
// ---------------------------------------------------------------
'use strict';

// Tags whose content is kept (with safe attributes only)
const ALLOWED_TAGS = new Set([
  'h1','h2','h3','h4','h5','h6',
  'p','br','hr',
  'strong','b','em','i','u','s','mark',
  'ul','ol','li',
  'blockquote','pre','code',
  'a',
  'img',
  'table','thead','tbody','tr','th','td',
  'div','span',
]);

// Per-tag attribute allowlists (plus a global set that applies to all tags)
const GLOBAL_ALLOWED_ATTRS = new Set(['class', 'id']);
const TAG_ALLOWED_ATTRS = {
  a:   new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading']),
  td:  new Set(['colspan', 'rowspan']),
  th:  new Set(['colspan', 'rowspan', 'scope']),
};

// Protocols allowed in href / src attributes
const SAFE_PROTOCOLS = /^(https?:|mailto:|#|\/)/i;

/**
 * Strip a single attribute value that contains a URL,
 * rejecting javascript:, data:, vbscript:, etc.
 */
function safeUrl(value) {
  const trimmed = value.replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
  if (/^javascript:/i.test(trimmed)) return '';
  if (/^data:/i.test(trimmed)) return '';
  if (/^vbscript:/i.test(trimmed)) return '';
  return value;
}

/**
 * Sanitise an attribute value.
 * Returns the cleaned value, or null to drop the attribute entirely.
 */
function sanitiseAttrValue(tag, attr, value) {
  // URL attributes get extra protocol checking
  if ((attr === 'href' && tag === 'a') || (attr === 'src' && tag === 'img')) {
    const safe = safeUrl(value.trim());
    if (!safe) return null;
    if (!SAFE_PROTOCOLS.test(safe) && !safe.startsWith('/')) return null;
    return safe;
  }
  // Drop event handlers (onclick, onerror, etc.)
  if (/^on/i.test(attr)) return null;
  // Reject style attributes (can contain expression() / url() vectors)
  if (attr === 'style') return null;
  return value;
}

/**
 * Parse and rebuild a tag string, keeping only safe attributes.
 * Returns the rebuilt opening tag, or '' to drop the tag.
 *
 * tagStr is the raw inner content of < >, e.g. 'a href="/foo" class="bar"'
 */
function sanitiseTag(tagStr) {
  // Extract tag name
  const match = tagStr.match(/^(\/?[a-z][a-z0-9]*)(.*)$/si);
  if (!match) return '';
  const rawTag  = match[1];
  const isClose = rawTag.startsWith('/');
  const tagName = rawTag.replace('/', '').toLowerCase();

  if (!ALLOWED_TAGS.has(tagName)) return '';
  if (isClose) return `</${tagName}>`;

  const rest = match[2];
  const allowed = new Set([
    ...GLOBAL_ALLOWED_ATTRS,
    ...(TAG_ALLOWED_ATTRS[tagName] || []),
  ]);

  // Parse attributes — handles both quoted and unquoted values
  const attrRegex = /\s+([a-z][a-z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/gi;
  let rebuilt = `<${tagName}`;
  let attrMatch;

  while ((attrMatch = attrRegex.exec(rest)) !== null) {
    const attr  = attrMatch[1].toLowerCase();
    const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';

    if (!allowed.has(attr)) continue;

    const safeValue = sanitiseAttrValue(tagName, attr, value);
    if (safeValue === null) continue;

    rebuilt += ` ${attr}="${safeValue.replace(/"/g, '&quot;')}"`;
  }

  // Force safe link behaviour
  if (tagName === 'a') {
    if (!rebuilt.includes('rel=')) rebuilt += ' rel="noopener noreferrer"';
    if (!rebuilt.includes('target=')) rebuilt += ' target="_blank"';
  }

  rebuilt += '>';
  return rebuilt;
}

/**
 * Main export.
 * @param {string} html - raw HTML from the rich-text editor
 * @returns {string} sanitised HTML safe to store and render
 */
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';

  return html
    // Replace tags one by one
    .replace(/<([^>]+)>/g, (_, inner) => sanitiseTag(inner.trim()))
    // Encode any bare < or > that weren't part of a valid tag
    .replace(/</g, (m, offset, str) => {
      // If followed by /, letter, or already encoded → leave; else encode
      const next = str[offset + 1];
      if (next && (/[a-z/!]/i.test(next))) return m;
      return '&lt;';
    });
}

module.exports = { sanitizeHtml };
