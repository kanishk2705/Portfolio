// scripts/deploy.js
// ---------------------------------------------------------------
// Publishes the site to GitHub Pages: builds dist/ (scripts/export.js)
// and force-pushes it as the only commit on the `gh-pages` branch.
// Your source code stays on `main`; gh-pages holds just the built site.
//
// Run with: npm run deploy   (uses your normal git login for the push)
// One-time setup: GitHub → repo Settings → Pages → Source: "Deploy from
// a branch" → Branch: gh-pages, folder: / (root).
// ---------------------------------------------------------------
'use strict';

const { execFileSync } = require('child_process');
const { exportSite } = require('./export');

const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }).trim();

try {
  const remote = git(['remote', 'get-url', 'origin']);
  const source = git(['rev-parse', '--short', 'HEAD']);
  const dirty  = git(['status', '--porcelain']) ? ' (with uncommitted changes)' : '';

  const { out, siteUrl } = exportSite();

  git(['init', '-q', '-b', 'gh-pages'], out);
  git(['add', '-A'], out);
  git(['commit', '-q', '-m', `Deploy site from ${source}${dirty}`], out);
  console.log(`Pushing to ${remote} (gh-pages)…`);
  git(['push', '-q', '--force', remote, 'gh-pages'], out);

  console.log(`\nDone. Live in about a minute at ${siteUrl}/`);
} catch (err) {
  console.error('\n[deploy] FAILED:', err.message);
  process.exit(1);
}
