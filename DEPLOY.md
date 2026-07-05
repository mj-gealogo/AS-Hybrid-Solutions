# Deploy checklist — A&S Auto Parts

Tick these off in order. Each step produces something the next one needs, so don't skip
ahead. Nothing here requires writing code — you're pasting values and clicking buttons.

> Placeholders to replace as you go: `<github-user>` (your GitHub username),
> `<repo>` (the repo name, e.g. `as-hybrid-solutions`), `<project>.pages.dev` (the URL
> Cloudflare gives you in step 2).

---

## 1. Push to GitHub

- [ ] `git init` is already done. Create the commits: `git add -A && git commit -m "Initial site"`
- [ ] Create a new **empty** repo on GitHub (no README/…gitignore — this folder already has them)
- [ ] `git remote add origin https://github.com/<github-user>/<repo>.git`
- [ ] `git branch -M main`
- [ ] `git push -u origin main`

## 2. Cloudflare Pages

- [ ] Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
- [ ] Pick your `<repo>`
- [ ] Build settings:
  - Framework preset: **Astro** (or "None")
  - **Build command:** `npm run build`
  - **Build output directory:** `dist`
- [ ] **Save and Deploy**. Wait for the first build to finish.
- [ ] Note your live URL: **`https://<project>.pages.dev`** ← you need this next

> ✅ At this point the **public site works** (home, catalog, product, contact). Only the
> admin's online saving is left.

## 3. GitHub OAuth App (lets the owner log in to /admin/)

- [ ] GitHub → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**
- [ ] Fill in:
  - **Application name:** `A&S Auto Parts admin` (anything)
  - **Homepage URL:** `https://<project>.pages.dev`
  - **Authorization callback URL:** `https://<project>.pages.dev/api/callback`
- [ ] **Register application**
- [ ] Copy the **Client ID** → _______________________
- [ ] **Generate a new client secret**, copy it now (shown once) → _______________________

## 4. Add the secrets to Cloudflare

- [ ] Cloudflare → your Pages project → **Settings** → **Variables and Secrets** (Production)
- [ ] Add `GITHUB_OAUTH_CLIENT_ID` = your Client ID
- [ ] Add `GITHUB_OAUTH_CLIENT_SECRET` = your Client Secret (mark as a **Secret**)
- [ ] Save

> These stay server-side (used only by `functions/api/callback.js`). Never commit them.

## 5. Point the admin at your repo

- [ ] Edit **`src/lib/admin-config.js`**:
  - `owner: '<github-user>'`
  - `repo: '<repo>'`
- [ ] Commit + push (this triggers a rebuild, and picks up the new env vars)

## 6. Test it

- [ ] Open `https://<project>.pages.dev/admin/`
- [ ] Click **Log in with GitHub** → approve
- [ ] Edit a product → **Save product**
- [ ] Check your GitHub repo — there should be a new commit changing a file under `content/`
- [ ] ~1 minute later the change is live on the site

---

## Gotchas

- **Private repo?** The default OAuth scope is `public_repo`. If your repo is private, change
  `scope: 'public_repo'` → `scope: 'repo'` in `functions/api/auth.js`, then push.
- **"Sign-in failed" / stuck popup:** the callback URL in the GitHub OAuth App must match
  `https://<project>.pages.dev/api/callback` **exactly** (https, no trailing slash).
- **Only people with write access** to the repo can log in and save — that's the security gate.
- **Local dev** (`npm run dev`) always stays in demo mode (saves to your browser only); GitHub
  mode only activates on the deployed domain.

---

## Before going fully live (owner content)

- [ ] Real contact details — phone, email, address, opening hours (currently placeholders in
      the nav/footer, home, contact and product pages)
- [ ] Real logo — swap the CSS hexagon mark for a transparent SVG/PNG
- [ ] Product photos — upload via the admin once online saving is working
- [ ] Contact form — get a free [Web3Forms](https://web3forms.com) access key and replace
      `YOUR_WEB3FORMS_KEY` in `src/pages/contact.astro`
