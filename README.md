# A&S Auto Parts — Catalog Website

A catalog-only car-parts website (no prices, no checkout). Customers browse parts by
category, search, view product details, and contact the business to order or request a
quote. A built-in admin (**Product manager**) lets the owner add/edit/delete products,
manage images and specs, and configure which category filters appear.

**Architecture:** static site, **no database**. Products and settings are plain files in
this repo; the site is pre-rendered to static HTML by **Astro**, and the admin edits those
files via **Decap CMS**. Deploys to **Cloudflare Pages**.

- **Framework:** [Astro](https://astro.build) (static output)
- **CMS:** [Decap CMS](https://decapcms.org) at `/admin/`
- **Hosting:** Cloudflare Pages (build `npm run build`, output `dist/`)

---

## Quick start

```sh
npm install
npm run dev
```

Open <http://localhost:4321>.

---

## The admin (Product manager)

The admin is a **custom-built "Product manager"** at `/admin/` ([src/pages/admin/index.astro](src/pages/admin/index.astro))
that matches the site design — product table, add/edit modal (images, specs, compatibility),
and the catalog-filter / home-category settings cards. Just run the site and open it:

```sh
npm run dev
# then open http://localhost:4321/admin/
```

**Two modes:**

- **Local (demo) — works today.** Edits are fully interactive and persist to your browser
  (`localStorage`), seeded from the real content files. This lets you use and preview the
  whole admin without any accounts. Note: in this mode changes do **not** rewrite the
  `content/` files — they live in the browser only.
- **Online (production) — added at deploy time.** On the deployed site the admin's data
  store is swapped to commit changes to the `content/` files via the GitHub API (behind a
  GitHub login), which triggers a Cloudflare rebuild so the live site updates. This half
  needs a GitHub repo + Cloudflare deployment + OAuth app, so it's wired up during
  deployment (see **Deploying** below). The UI is identical in both modes.

---

## Content model (source of truth)

Everything the site renders comes from files in `content/`:

```text
content/
├── products/                 # one Markdown file per product (frontmatter + body)
│   ├── headlight-assembly.md
│   └── ...
├── settings.json             # which category chips/home categories show; condition filter on/off
├── categories.json           # ordered list of category names
└── conditions.json           # ordered list of condition names
public/uploads/               # product images (uploaded via the admin)
```

A product file looks like this:

```markdown
---
id: "p01"
name: "Headlight Assembly"
category: "Lights"          # must exist in categories.json
condition: "New"            # must exist in conditions.json
sku: "AS-LT-1042"
shortDesc: "Complete OE-spec headlight unit, plug-and-play fitment."
gallery:                    # first image = card thumbnail; 2+ = carousel
  - { src: "/uploads/headlight-1.jpg", label: "Front view" }
specs:                      # empty => Specifications section hidden
  - { label: "Side", value: "Driver / O/S" }
compatibility:              # the "Fits" list on the product page
  - "VW Golf Mk7 (2013–2019)"
---

Long description shown on the product page. Line breaks are preserved.
```

`settings.json` controls the storefront filters (order matters — chips/home categories
render in the order listed):

```jsonc
{
  "chipCats": ["Lights", "Batteries", "ABS Pumps", "Engine", "Gearbox"], // catalog quick-filter chips
  "homeCats": ["Lights", "Batteries", "ABS Pumps", "Engine", "Gearbox", "Suspension"], // home "Shop by category"
  "conditionFilter": true   // show/hide the Condition facet in the catalog sidebar
}
```

---

## Project structure

```text
src/
├── layouts/Base.astro         # <html> shell, global styles, fonts, responsive helpers
├── components/                # Nav, Footer, ProductCard
├── lib/
│   ├── content.ts             # reads + parses content/ files at build time
│   └── admin-config.js        # owner/repo/branch for the admin's GitHub mode
├── scripts/
│   └── admin-backends.js      # Local (demo) + GitHub (commit) data stores for the admin
└── pages/
    ├── index.astro            # Home
    ├── catalog/index.astro    # Catalog (search + filters + pager)
    ├── catalog/[slug].astro   # Product detail (one static page per product)
    ├── contact.astro          # Enquiry form
    └── admin/index.astro      # Custom "Product manager" admin (served at /admin/)
functions/api/
├── auth.js                    # Cloudflare Function — starts GitHub OAuth login
└── callback.js                # Cloudflare Function — completes login, returns token
public/
├── _headers                   # Cloudflare security headers (CSP, etc.)
└── uploads/                   # product images
```

---

## Commands

| Command            | Action                                          |
| :----------------- | :---------------------------------------------- |
| `npm install`      | Install dependencies                            |
| `npm run dev`      | Dev server at `localhost:4321` (admin at /admin/) |
| `npm run build`    | Build static site to `./dist/`                  |
| `npm run preview`  | Preview the production build locally            |

---

## Deploying to Cloudflare Pages

All the code is in place (including the admin's online-saving layer). You just fill in
real values. Do these in order — each step produces something the next one needs.

**1. Push to GitHub.** Create a repo and push this project folder.

**2. Cloudflare Pages.** Create project → connect the repo. Build command `npm run build`,
output directory `dist`. It redeploys on every push and gives you a free `*.pages.dev` URL
(no custom domain needed). Note that URL — you need it in step 3.

**3. GitHub OAuth App.** GitHub → Settings → Developer settings → **OAuth Apps** → New:
   - **Homepage URL:** your `https://<project>.pages.dev`
   - **Authorization callback URL:** `https://<project>.pages.dev/api/callback`
   - Save. Copy the **Client ID**, then **Generate a new client secret** and copy that too.

**4. Add the secrets to Cloudflare Pages** (Settings → Environment variables → Production):
   - `GITHUB_OAUTH_CLIENT_ID` = the Client ID
   - `GITHUB_OAUTH_CLIENT_SECRET` = the Client Secret
   These stay server-side (used only by `functions/api/callback.js`); never commit them.

**5. Set your repo in code.** Edit [`src/lib/admin-config.js`](src/lib/admin-config.js) —
   set `owner` and `repo` to your GitHub username + repo name. Commit and push (triggers a
   rebuild).

**6. Done.** Open `https://<project>.pages.dev/admin/`, click **Log in with GitHub**, and
   edits will commit to your content files → the site rebuilds within ~a minute.

**Notes:**
- The OAuth scope is `public_repo` (safe, works for a **public** repo). If your repo is
  **private**, change `scope` to `repo` in [`functions/api/auth.js`](functions/api/auth.js).
- Only GitHub accounts with **write access** to the repo can save — that's your admin gate.
- Locally (`npm run dev`) the admin stays in demo mode (localStorage); GitHub mode only
  activates on the deployed domain.

### How the admin's online saving works (already built)

- **`functions/api/auth.js` + `functions/api/callback.js`** — the GitHub OAuth flow. The
  admin opens a popup; the callback exchanges the code for a token (secret stays server-side)
  and hands it back via `postMessage`.
- **[`src/scripts/admin-backends.js`](src/scripts/admin-backends.js)** — the `GitHubBackend`
  reads and commits `content/*` files (and uploads images to `public/uploads/`) via the
  GitHub Contents API. The `LocalBackend` is the localStorage demo used on localhost.
- The admin UI is identical in both modes; it just picks the backend based on the hostname.

### Still to provide before going fully live

- Real contact details (phone, email, address, opening hours) — currently placeholders.
- A real logo (transparent SVG/PNG) to replace the CSS hexagon mark.
- Product photos (upload via the admin).
- A [Web3Forms](https://web3forms.com) access key for the contact form — replace
  `YOUR_WEB3FORMS_KEY` in `src/pages/contact.astro`.
