// middleware/validate.js
// ---------------------------------------------------------------
// Lightweight server-side input validation used on all admin API
// routes that receive a body.  We validate at the middleware layer
// (not only in the DB layer) so malformed/oversized data is
// rejected early with a helpful 400 message.
//
// No external library — the rules are simple enough to express
// inline, and avoiding a large validation library keeps the bundle
// small for a single-admin system.
// ---------------------------------------------------------------
'use strict';

// ---- Rule primitives ----

/** Reject if value is present but not a string. */
function isString(val, field) {
  if (val !== undefined && val !== null && typeof val !== 'string') {
    return `"${field}" must be a string.`;
  }
}

/** Reject if value is required and missing/empty. */
function isRequired(val, field) {
  if (val === undefined || val === null || String(val).trim() === '') {
    return `"${field}" is required.`;
  }
}

/** Reject if value exceeds maxLen characters. */
function maxLen(val, field, limit) {
  if (val && String(val).length > limit) {
    return `"${field}" must be ${limit} characters or fewer.`;
  }
}

/** Reject if value is not a safe URL (or empty). */
function isUrl(val, field) {
  if (!val) return;
  try {
    const u = new URL(val);
    if (!['http:', 'https:', 'mailto:'].includes(u.protocol)) {
      return `"${field}" must use http, https, or mailto.`;
    }
  } catch {
    return `"${field}" must be a valid URL.`;
  }
}

/** Accept a site-relative asset path ("/uploads/…", "/assets/…") or a full http(s) URL. */
function isPathOrUrl(val, field) {
  if (!val) return;
  if (typeof val === 'string' && /^\/(uploads|assets)\/[\w\-./]+$/.test(val) && !val.includes('..')) return;
  return isUrl(val, field);
}

/**
 * Validate an array of objects. `check(item)` returns an error string or
 * undefined for each item; the first error wins.
 */
function isObjectArray(val, field, check, { maxItems = 50 } = {}) {
  if (val === undefined || val === null) return;
  if (!Array.isArray(val)) return `"${field}" must be an array.`;
  if (val.length > maxItems) return `"${field}" must have at most ${maxItems} items.`;
  for (const item of val) {
    if (typeof item !== 'object' || item === null) return `"${field}" items must be objects.`;
    const err = check(item);
    if (err) return err;
  }
}

/** Reject if value is not an integer (or missing when required). */
function isInt(val, field, { min, max, required } = {}) {
  if (required && (val === undefined || val === null)) return `"${field}" is required.`;
  if (val === undefined || val === null) return;
  const n = Number(val);
  if (!Number.isInteger(n)) return `"${field}" must be an integer.`;
  if (min !== undefined && n < min) return `"${field}" must be at least ${min}.`;
  if (max !== undefined && n > max) return `"${field}" must be at most ${max}.`;
}

/** Reject if value is not a boolean-like (true/false/0/1). */
function isBool(val, field) {
  if (val !== undefined && val !== null && ![0, 1, true, false].includes(val)) {
    return `"${field}" must be true or false.`;
  }
}

/** Reject if value is not an array of strings (or missing). */
function isStringArray(val, field, { maxItems = 50, maxItemLen = 200 } = {}) {
  if (val === undefined || val === null) return;
  if (!Array.isArray(val)) return `"${field}" must be an array.`;
  if (val.length > maxItems) return `"${field}" must have at most ${maxItems} items.`;
  for (const item of val) {
    if (typeof item !== 'string') return `"${field}" items must be strings.`;
    if (item.length > maxItemLen) return `"${field}" items must be ${maxItemLen} chars or fewer.`;
  }
}

// ---- Rule sets ----

const RULES = {
  project: (body) => {
    const errors = [];
    const add = (msg) => { if (msg) errors.push(msg); };

    add(isRequired(body.title, 'title'));
    add(maxLen(body.title, 'title', 200));
    add(isString(body.slug, 'slug'));
    add(maxLen(body.slug, 'slug', 200));
    add(isString(body.short_description, 'short_description'));
    add(isRequired(body.short_description, 'short_description'));
    add(maxLen(body.short_description, 'short_description', 500));

    const richFields = ['overview','problem_statement','dataset_info','methodology',
                        'implementation_details','results','future_improvements',
                        'my_role','key_learnings'];
    for (const f of richFields) {
      add(isString(body[f], f));
      add(maxLen(body[f], f, 100_000));
    }

    for (const f of ['github_url', 'demo_url', 'research_paper_url']) {
      add(isUrl(body[f], f));
      add(maxLen(body[f], f, 1000));
    }
    for (const f of ['thumbnail_path', 'banner_path', 'architecture_diagram_path', 'workflow_diagram_path']) {
      add(isPathOrUrl(body[f], f));
      add(maxLen(body[f], f, 1000));
    }

    add(isObjectArray(body.images, 'images', (img) =>
      isPathOrUrl(img.file_path, 'images.file_path') || isRequired(img.file_path, 'images.file_path')
      || maxLen(img.alt_text, 'images.alt_text', 300) || maxLen(img.caption, 'images.caption', 500),
    { maxItems: 60 }));

    add(isObjectArray(body.videos, 'videos', (v) => {
      if (!['upload', 'external'].includes(v.source_type)) return '"videos.source_type" must be "upload" or "external".';
      if (v.source_type === 'upload') return isRequired(v.file_path, 'videos.file_path') || isPathOrUrl(v.file_path, 'videos.file_path');
      return isRequired(v.external_url, 'videos.external_url') || isUrl(v.external_url, 'videos.external_url')
        || maxLen(v.title, 'videos.title', 300);
    }, { maxItems: 20 }));

    add(isObjectArray(body.documents, 'documents', (d) =>
      isRequired(d.file_path, 'documents.file_path') || isPathOrUrl(d.file_path, 'documents.file_path')
      || maxLen(d.label, 'documents.label', 200),
    { maxItems: 20 }));

    add(isObjectArray(body.timeline, 'timeline', (e) =>
      isRequired(e.title, 'timeline.title') || maxLen(e.title, 'timeline.title', 200)
      || maxLen(e.date_label, 'timeline.date_label', 60) || maxLen(e.description, 'timeline.description', 2000),
    { maxItems: 40 }));

    if (body.related_ids !== undefined && body.related_ids !== null) {
      if (!Array.isArray(body.related_ids) || body.related_ids.length > 12
          || !body.related_ids.every((n) => Number.isInteger(n) && n > 0)) {
        errors.push('"related_ids" must be an array of at most 12 project ids.');
      }
    }

    if (body.category_id !== undefined && body.category_id !== null) {
      add(isInt(body.category_id, 'category_id', { min: 1 }));
    }
    add(isInt(body.display_order, 'display_order', { min: 0, max: 9999 }));
    add(isBool(body.is_featured, 'is_featured'));

    if (body.project_status !== undefined && !['completed','ongoing','planned'].includes(body.project_status)) {
      errors.push('"project_status" must be completed, ongoing or planned.');
    }
    for (const f of ['started_on', 'completed_on']) {
      if (body[f] && !/^\d{4}-(0[1-9]|1[0-2])$/.test(body[f])) errors.push(`"${f}" must be a month in YYYY-MM format.`);
    }
    if (body.started_on && body.completed_on && body.completed_on < body.started_on) {
      errors.push('The completion month cannot be before the start month.');
    }

    if (body.status !== undefined && !['draft','published'].includes(body.status)) {
      errors.push('"status" must be "draft" or "published".');
    }

    add(isStringArray(body.technologies, 'technologies', { maxItems: 30, maxItemLen: 100 }));
    add(isStringArray(body.tags, 'tags', { maxItems: 30, maxItemLen: 100 }));

    if (body.metrics !== undefined) {
      if (!Array.isArray(body.metrics)) {
        errors.push('"metrics" must be an array.');
      } else if (body.metrics.length > 20) {
        errors.push('"metrics" must have at most 20 items.');
      } else {
        for (const m of body.metrics) {
          if (typeof m?.label !== 'string' || typeof m?.value !== 'string') {
            errors.push('"metrics" items must have string "label" and "value" fields.');
            break;
          }
          if (m.label.length > 100 || m.value.length > 100) {
            errors.push('"metrics" label and value must be 100 characters or fewer.');
            break;
          }
        }
      }
    }

    return errors;
  },

  category: (body) => {
    const errors = [];
    const add = (msg) => { if (msg) errors.push(msg); };
    add(isRequired(body.name, 'name'));
    add(maxLen(body.name, 'name', 100));
    add(isRequired(body.slug, 'slug'));
    add(maxLen(body.slug, 'slug', 100));
    if (!/^[a-z0-9-]+$/.test(body.slug || '')) {
      errors.push('"slug" may only contain lowercase letters, numbers and hyphens.');
    }
    add(maxLen(body.description, 'description', 500));
    add(isInt(body.sort_order, 'sort_order', { min: 0, max: 999 }));
    return errors;
  },

  certificate: (body) => {
    const errors = [];
    const add = (msg) => { if (msg) errors.push(msg); };
    add(isRequired(body.title, 'title'));
    add(maxLen(body.title, 'title', 300));
    add(isRequired(body.issuer, 'issuer'));
    add(maxLen(body.issuer, 'issuer', 200));
    add(maxLen(body.issue_date, 'issue_date', 50));
    if (body.credential_url) add(isUrl(body.credential_url, 'credential_url'));
    add(isInt(body.sort_order, 'sort_order', { min: 0, max: 999 }));
    return errors;
  },

  education: (body) => {
    const errors = [];
    const add = (msg) => { if (msg) errors.push(msg); };
    add(isObjectArray(body.items, 'items', (e) =>
      isRequired(e.institution, 'Institution') || isRequired(e.degree, 'Degree')
      || maxLen(e.institution, 'Institution', 200) || maxLen(e.degree, 'Degree', 200)
      || maxLen(e.location, 'Location', 120) || maxLen(e.start_label, 'Start', 40)
      || maxLen(e.end_label, 'End', 40) || maxLen(e.grade, 'Grade', 80)
      || maxLen(e.highlights, 'Highlights', 3000),
    { maxItems: 20 }));
    if (!Array.isArray(body.items)) errors.push('"items" must be an array.');
    return errors;
  },

  experience: (body) => {
    const errors = [];
    const add = (msg) => { if (msg) errors.push(msg); };
    add(isObjectArray(body.items, 'items', (e) =>
      isRequired(e.role, 'Role') || isRequired(e.organization, 'Organization')
      || maxLen(e.role, 'Role', 200) || maxLen(e.organization, 'Organization', 200)
      || isUrl(e.organization_url, 'Organization website') || maxLen(e.organization_url, 'Organization website', 500)
      || maxLen(e.location, 'Location', 120) || maxLen(e.employment_type, 'Type', 60)
      || maxLen(e.start_label, 'Start', 40) || maxLen(e.end_label, 'End', 40)
      || maxLen(e.highlights, 'Highlights', 4000),
    { maxItems: 40 }));
    if (!Array.isArray(body.items)) errors.push('"items" must be an array.');
    return errors;
  },

  skillCategory: (body) => {
    const errors = [];
    const add = (msg) => { if (msg) errors.push(msg); };
    add(isRequired(body.name, 'name'));
    add(maxLen(body.name, 'name', 100));
    add(maxLen(body.icon, 'icon', 40));
    add(isInt(body.sort_order, 'sort_order', { min: 0, max: 999 }));
    return errors;
  },

  skill: (body) => {
    const errors = [];
    const add = (msg) => { if (msg) errors.push(msg); };
    add(isInt(body.skill_category_id, 'skill_category_id', { min: 1, required: true }));
    add(isRequired(body.name, 'name'));
    add(maxLen(body.name, 'name', 100));
    add(isInt(body.proficiency, 'proficiency', { min: 1, max: 100 }));
    add(isInt(body.sort_order, 'sort_order', { min: 0, max: 999 }));
    return errors;
  },

  settings: (body) => {
    const errors = [];
    if (typeof body !== 'object' || Array.isArray(body) || body === null) {
      return ['"settings" body must be a key/value object.'];
    }
    const entries = Object.entries(body);
    if (entries.length > 100) return ['Too many settings keys (max 100 per request).'];
    for (const [k, v] of entries) {
      if (typeof k !== 'string' || k.length > 200) {
        errors.push(`Settings key "${k}" must be a string of at most 200 characters.`);
      }
      if (v !== null && typeof v !== 'string') {
        errors.push(`Settings value for "${k}" must be a string or null.`);
      }
      if (v && v.length > 20_000) {
        errors.push(`Settings value for "${k}" exceeds 20,000 characters.`);
      }
    }
    if (errors.length) return errors;

    // Values that end up in href/src attributes on the public site
    const add = (msg) => { if (msg) errors.push(msg); };
    for (const k of ['contact.github', 'contact.linkedin', 'contact.resume_url']) {
      add(isUrl(body[k], k));
    }
    add(isPathOrUrl(body['og.image'], 'og.image'));
    const cta = body['hero.cta_secondary_url'];
    // "#section", "/page" (not "//host"), or a full URL
    if (cta && !/^#[\w-]*$/.test(cta) && !/^\/(?!\/)/.test(cta)) add(isUrl(cta, 'hero.cta_secondary_url'));
    const email = body['contact.email'];
    if (email && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) {
      errors.push('"contact.email" must be a valid email address.');
    }
    for (const key of ['timeline.items', 'research.items']) {
      if (!body[key]) continue;
      try {
        if (!Array.isArray(JSON.parse(body[key]))) throw new Error();
      } catch {
        errors.push(`"${key}" must be a JSON array.`);
      }
    }
    const cv = body['cv.file'];
    if (cv && !/^\/uploads\/documents\/[\w.-]+\.pdf$/i.test(cv)) {
      errors.push('The CV must be an uploaded PDF.');
    }
    return errors;
  },
};

/**
 * Build an Express middleware that validates req.body against a named rule set.
 * Returns 400 with the first error message if validation fails.
 */
function validate(ruleName) {
  const rules = RULES[ruleName];
  if (!rules) throw new Error(`No validation rules defined for "${ruleName}".`);

  return (req, res, next) => {
    const errors = rules(req.body || {});
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors[0] });
    }
    next();
  };
}

module.exports = { validate };
