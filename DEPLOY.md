# Publishing the site — GitHub Pages (free)

The site is published as **static files** on GitHub Pages: free, fast, never
asleep, and nothing to maintain or secure on a server.

- You edit content in the **admin panel on your own computer**.
- `npm run deploy` turns the site into static files and pushes them to the
  `gh-pages` branch. GitHub Pages serves that branch.
- Your source code lives on `main`. Your database, uploads and `.env` never
  leave your computer — only what visitors can see is published (no drafts,
  no admin panel).

Live URL: **https://kanishk2705.github.io/Portfolio/**

---

## One-time setup

1. Push the code (already done):
   ```bash
   git remote add origin https://github.com/kanishk2705/Portfolio.git
   git push -u origin main
   ```
2. Publish once so the `gh-pages` branch exists:
   ```bash
   npm run deploy
   ```
3. On GitHub: **Portfolio → Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: **gh-pages**, folder **/ (root)** → **Save**
4. After about a minute the site is live at the URL above.

---

## Everyday workflow

```bash
npm run dev          # http://localhost:3000/admin — add / edit content
npm run deploy       # publish the current content (about a minute to go live)
```

To check the static build before publishing: `npm run export` writes it to
`dist/` without pushing anything.

When you change **code** (not just content), also commit and push it:

```bash
git add -A
git commit -m "Describe the change"
git push
```

---

## Back up your content

Your content lives in `database/portfolio.db` and `uploads/` on your computer,
and neither is in git (the repo is public). Copy both somewhere safe — Google
Drive, OneDrive or a USB drive — every so often, and always before
reinstalling or changing computers.

---

## Custom domain (optional, later)

1. Buy a domain (e.g. `kanishk.dev`; the GitHub Student Developer Pack has
   included a free domain for a year).
2. Add to `.env`: `EXPORT_SITE_URL=https://kanishk.dev`
3. `npm run deploy` — this also writes the `CNAME` file GitHub Pages needs.
4. GitHub → Settings → Pages → Custom domain → `kanishk.dev`, then follow
   GitHub's DNS instructions and tick **Enforce HTTPS**.

---

## How the URL is worked out

`npm run export` reads `EXPORT_SITE_URL` from `.env`. If it is not set, it uses
the git remote: `github.com/<user>/<repo>` → `https://<user>.github.io/<repo>`.
All links, the sitemap and link-preview tags use that URL.

---

## Alternative: run the full app on Render (paid)

If you ever need the admin panel online (e.g. editing from another computer),
`render.yaml` deploys the whole Node app to Render. This needs the **Starter
plan (~$7/month)**: the free plan has no persistent disk, so the database and
uploads would be wiped on every restart. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`
and `SITE_URL` in the Render dashboard; the build runs `npm run build:db` and
`npm run seed` automatically (both are safe to re-run).
