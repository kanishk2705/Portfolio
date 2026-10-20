// utils/githubImport.js
// ---------------------------------------------------------------
// Builds a draft project from a public GitHub repository:
//   repo details → title, short description, links, tags, start month
//   languages    → technology stack
//   README       → write-up, split by heading into the project fields
//
// Nothing is saved here; the admin form is pre-filled for review.
// Unauthenticated GitHub API calls are limited to 60/hour per IP;
// set GITHUB_TOKEN to raise that.
// ---------------------------------------------------------------
'use strict';

const { marked } = require('marked');
const { sanitizeHtml } = require('./sanitize');

const API = 'https://api.github.com';

// Heading keywords → project field. Checked in order; first match wins.
// 'skip' sections (setup, licence…) belong on GitHub, not in a write-up.
const SECTION_RULES = [
  ['results',                /result|performance|evaluat|metric|accuracy|benchmark|finding|screenshot|output|demo/],
  ['future_improvements',    /future|roadmap|todo|to-do|next step|improvement|limitation/],
  ['skip',                   /install|setup|set up|getting started|usage|how to run|run locally|running|requirement|prerequisite|licen[cs]e|contribut|contact|author|acknowledg|credit|citation|table of contents|^contents$|support|faq/],
  ['dataset_info',           /dataset|\bdata\b|data source|data collection|corpus/],
  ['problem_statement',      /problem|motivation|objective|background|why|goal|challenge/],
  ['implementation_details', /implementation|architecture|tech stack|technolog|built with|stack|system design|project structure|folder structure|structure|deployment|api/],
  ['methodology',            /method|approach|model|pipeline|how it works|algorithm|training|preprocess|feature engineering|workflow/],
];

class ImportError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** "https://github.com/user/repo(.git)(/tree/...)" → { owner, repo } */
function parseRepoUrl(input) {
  const m = String(input || '').trim()
    .match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (!m) throw new ImportError(400, 'Enter a GitHub repository URL like https://github.com/user/repo');
  return { owner: m[1], repo: m[2] };
}

async function gh(path, { raw = false } = {}) {
  const headers = {
    'User-Agent': 'portfolio-github-import',
    Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let res;
  try {
    res = await fetch(API + path, { headers, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new ImportError(502, 'Could not reach GitHub. Check your internet connection and try again.');
  }
  if (res.status === 404) return null;
  if (res.status === 403 || res.status === 429) {
    throw new ImportError(429, 'GitHub rate limit reached (60 requests/hour without a token). Try again later, or set GITHUB_TOKEN in .env.');
  }
  if (!res.ok) throw new ImportError(502, `GitHub returned an error (${res.status}).`);
  return raw ? res.text() : res.json();
}

function humanise(name) {
  return name.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const toMonth = (iso) => (iso ? iso.slice(0, 7) : null);

// Leading emoji / symbols, e.g. "🤖 Market Sentinel" → "Market Sentinel"
const stripLeadingSymbols = (text) => text.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();

// GitHub language names → how they read on a tech stack; null = leave out
const LANGUAGE_NAMES = {
  'Jupyter Notebook': 'Jupyter', Dockerfile: 'Docker',
  Shell: null, Batchfile: null, PowerShell: null, Makefile: null, Procfile: null,
};

// Skip lines like "Live demo: …" / "Project Status: …" when picking a description
const NOT_A_DESCRIPTION = /^(live demo|demo|status|project status|architect|author|note|built by)\b/i;

/** Point relative README links/images at GitHub so they work on the portfolio. */
function absolutiseUrls(html, { owner, repo, branch }) {
  return html.replace(/\b(src|href)="([^"]+)"/g, (whole, attr, url) => {
    if (/^(https?:|mailto:|#|data:)/i.test(url)) return whole;
    const clean = url.replace(/^\.?\//, '');
    const base = attr === 'src'
      ? `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`
      : `https://github.com/${owner}/${repo}/blob/${branch}/`;
    return `${attr}="${base}${clean}"`;
  });
}

/** Drop status badges (shields.io etc.) — noise outside GitHub. */
function stripBadges(html) {
  return html
    .replace(/<a [^>]*>\s*(<img [^>]*(shields\.io|badge|badgen\.net|travis-ci|codecov|github\.com\/[^"]*\/workflows)[^>]*>\s*)+<\/a>/gi, '')
    .replace(/<img [^>]*(shields\.io|badge|badgen\.net|travis-ci|codecov)[^>]*>/gi, '')
    .replace(/<p>\s*<\/p>/g, '');
}

function classify(heading) {
  const h = heading.toLowerCase();
  for (const [field, re] of SECTION_RULES) if (re.test(h)) return field;
  return 'overview';
}

/**
 * Split README markdown into project fields by heading.
 * The section level is the shallowest heading below a lone top-level title.
 */
function splitReadme(markdown, repoInfo) {
  const tokens = marked.lexer(markdown);
  const headings = tokens.filter((t) => t.type === 'heading');

  // A single h1 at the top is the title, not a section
  let title = null;
  if (headings.filter((h) => h.depth === 1).length === 1 && tokens.find((t) => t.type !== 'space') === headings[0]) {
    title = stripLeadingSymbols(headings[0].text.replace(/[*_`]/g, ''));
    tokens.splice(tokens.indexOf(headings[0]), 1);
  }
  const sectionDepth = Math.min(...tokens.filter((t) => t.type === 'heading').map((t) => t.depth), 99);

  // Group tokens into [{ heading, tokens }]
  const groups = [{ heading: null, tokens: [] }];
  for (const t of tokens) {
    if (t.type === 'heading' && t.depth === sectionDepth) groups.push({ heading: t.text, tokens: [] });
    else groups[groups.length - 1].tokens.push(t);
  }

  const render = (toks) => {
    const list = Object.assign([...toks], { links: tokens.links });
    return sanitizeHtml(stripBadges(absolutiseUrls(marked.parser(list), repoInfo))).trim();
  };

  const fields = {};
  const skipped = [];
  const append = (field, heading, html) => {
    if (!html) return;
    fields[field] = fields[field] || [];
    fields[field].push({ heading, html });
  };

  for (const g of groups) {
    const html = render(g.tokens);
    if (!g.heading) { append('overview', null, html); continue; }
    const field = classify(g.heading);
    if (field === 'skip') { skipped.push(g.heading); continue; }
    append(field, g.heading, html);
  }

  // Join each field; keep sub-headings where several sections were merged,
  // and always in the overview (which collects unmatched sections)
  const out = {};
  for (const [field, parts] of Object.entries(fields)) {
    const showHeadings = field === 'overview' || parts.length > 1;
    out[field] = parts.map(({ heading, html }) =>
      (showHeadings && heading ? `<h3>${sanitizeHtml(marked.parseInline(heading))}</h3>` : '') + html,
    ).join('\n');
  }

  const firstImage = (markdown.match(/!\[[^\]]*\]\(([^)\s]+)/g) || [])
    .map((m) => m.replace(/^!\[[^\]]*\]\(/, ''))
    .find((src) => !/shields\.io|badge|badgen|travis|codecov/i.test(src));

  return { title, fields: out, skipped, firstImage };
}

async function importFromGithub(url) {
  const { owner, repo } = parseRepoUrl(url);

  const info = await gh(`/repos/${owner}/${repo}`);
  if (!info) throw new ImportError(404, `Repository ${owner}/${repo} not found. Is it public?`);
  if (info.private) throw new ImportError(400, 'Only public repositories can be imported.');

  const [languages, readme] = await Promise.all([
    gh(`/repos/${owner}/${repo}/languages`),
    gh(`/repos/${owner}/${repo}/readme`, { raw: true }),
  ]);

  const repoInfo = { owner: info.owner.login, repo: info.name, branch: info.default_branch };
  const parsed = readme ? splitReadme(readme, repoInfo) : { title: null, fields: {}, skipped: [], firstImage: null };

  const technologies = Object.entries(languages || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([lang]) => (lang in LANGUAGE_NAMES ? LANGUAGE_NAMES[lang] : lang))
    .filter(Boolean);

  const firstParagraph = [...(parsed.fields.overview || '').matchAll(/<p>(.*?)<\/p>/gs)]
    .map((m) => stripLeadingSymbols(m[1].replace(/<[^>]+>/g, '')))
    .find((text) => text.length >= 60 && !NOT_A_DESCRIPTION.test(text));

  let thumbnail = null;
  if (parsed.firstImage) {
    thumbnail = absolutiseUrls(`src="${parsed.firstImage}"`, repoInfo).slice(5, -1);
  }

  const notes = [];
  if (!readme) notes.push('This repository has no README, so only the basic details were filled in.');
  if (parsed.skipped.length) notes.push(`Left out setup-style sections: ${parsed.skipped.join(', ')}.`);
  notes.push('The start month is when the repository was created. Change it if the project began earlier.');
  if (thumbnail) notes.push('The first README image was set as the thumbnail. It is loaded from GitHub; upload your own for best results.');

  return {
    project: {
      title:             parsed.title && parsed.title.length <= 120 ? parsed.title : humanise(info.name),
      short_description: (info.description || firstParagraph || '').slice(0, 500),
      github_url:        info.html_url,
      demo_url:          /^https?:\/\//.test(info.homepage || '') ? info.homepage : null,
      technologies,
      tags:              (info.topics || []).slice(0, 15),
      started_on:        toMonth(info.created_at),
      last_activity_on:  toMonth(info.pushed_at),
      thumbnail_path:    thumbnail,
      ...parsed.fields,
    },
    notes,
  };
}

module.exports = { importFromGithub, parseRepoUrl, splitReadme, ImportError };
