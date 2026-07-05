# Handoff: A&S Auto Parts — Catalog Website + Admin

## Overview
A&S Auto Parts is a **catalog-only** car-parts website (no prices, no online checkout). Customers browse parts by category and search, open a product to see images + description + specs, and **contact the business to order / request a quote**. A built-in **admin ("Product manager")** lets the owner add/edit/delete products, manage product images and specifications, and configure which category filters appear on the catalog and home page.

Target architecture is a **static site with NO database** (JAMstack): products and settings are stored as files, the site is pre-rendered to static HTML/CSS/JS, and served from a CDN. The admin writes to those files via a Git-based CMS or a thin serverless function. See **"Production Architecture"** below — this is central to the build.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing the intended look, layout, copy, and behavior. They are **not production code to ship directly**.

The prototype is authored as a "Design Component" (`A&S Auto Parts.dc.html`) that uses a small in-house template runtime (`support.js`) plus inline styles. **Do not port the runtime.** Recreate the design in the project's chosen production stack using its own conventions. Recommended stack for a no-database catalog: **Astro** (or Next.js static export / SvelteKit) + **Decap CMS** (formerly Netlify CMS) or **TinaCMS** for the admin, deployed to **Cloudflare Pages** or **Netlify**. If the implementer prefers another static framework, that's fine — match the architecture, not the tooling.

The prototype currently persists admin changes to **browser localStorage** purely so the demo is interactive. In production this is replaced by file-based content (see below).

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, layout, copy, and interactions are all intentional and should be recreated faithfully. Exact tokens are listed under **Design Tokens**.

---

## Production Architecture (no database)

**Source of truth = files in a Git repo.**

```
/content
  /products
    headlight-assembly.md        # one file per product (front-matter + body)
    agm-battery-12v.md
    ...
  settings.json                  # catalog/home filter settings (see schema)
  categories.json                # ordered list of category names
  conditions.json                # ordered list of condition names
/public/uploads/                 # product images (or use an image CDN)
```

**Flow when the admin saves:**
1. Admin edits in the Product manager UI (same screens as the prototype).
2. On save, the CMS commits the change to the repo: a product file is created/updated/deleted, images are written to `/public/uploads/`, or `settings.json` is updated.
3. The commit triggers a **rebuild** (Astro/Next build) on the host.
4. The host publishes the regenerated static pages to the CDN. Live within ~seconds–1 minute.

**Authentication:** only the admin area is protected. Use the CMS's built-in identity (GitHub/Google OAuth via Decap/Tina, or Cloudflare Access in front of `/admin`). Customers never log in.

**Contact form:** posts to a form service (**Web3Forms**, **Formspree**, or **Netlify Forms**) that emails the business. No server needed. Include spam protection (honeypot + the service's built-in filtering). Never collect vehicle registration (explicitly removed — see Contact screen).

**Security/best-practice checklist for the implementer:**
- No database, no server-side query surface. Keep it that way unless real e-commerce is added later.
- Sanitize/escape any product copy rendered to HTML (defend against stored XSS via the CMS).
- Lock the admin behind OAuth; never roll a custom password store.
- Set security headers (CSP, X-Content-Type-Options, Referrer-Policy) at the host edge.
- Validate image uploads (type + size); downscale large images at build or upload time (the prototype downscales to max 1000px JPEG ~0.82 quality — replicate or use the host's image pipeline).
- Keep the contact form's recipient address server-side in the form service, not in client code.

---

## Content Model (schemas)

### Product
```jsonc
{
  "id": "p01",                       // stable slug/id
  "name": "Headlight Assembly",      // string, required
  "category": "Lights",              // must exist in categories.json
  "condition": "New",                // must exist in conditions.json
  "sku": "AS-LT-1042",               // part reference, string
  "shortDesc": "Complete OE-spec headlight unit, plug-and-play fitment.", // one-line, shown on cards
  "description": "Long description...", // multi-line, shown on product page (preserve line breaks)
  "gallery": [                        // ordered; first image = card thumbnail
    { "src": "/uploads/headlight-1.jpg", "label": "Front view" }
  ],
  "specs": [                          // ordered key/value pairs; empty array => Specifications section hidden
    { "label": "Side", "value": "Driver / O/S" }
  ],
  "compatibility": ["VW Golf Mk7 (2013–2019)", "Audi A3 8V"] // "Fits" list on product page
}
```
Notes:
- **Images:** 0 = grey placeholder; 1 = single static image; 2+ = carousel (arrows + dots + thumbnails) on the product page. Card/thumbnail always uses the **first** gallery image.
- **Specs:** if `specs` is empty, **do not render** the Specifications section at all.
- Image order is admin-controlled (drag to reorder in the editor). The first image is the primary/thumbnail.

### settings.json
```jsonc
{
  "chipCats": ["Lights","Batteries","ABS Pumps","Engine","Gearbox"], // quick-filter chips on catalog, IN THIS ORDER
  "homeCats": ["Lights","Batteries","ABS Pumps","Engine","Gearbox","Suspension"], // home "Shop by category" panel, IN THIS ORDER
  "conditionFilter": true            // show/hide the Condition facet in the catalog sidebar
}
```
- Order matters: chips and home categories render in **the order the admin added them**, not alphabetical or master order.
- These are **explicit allow-lists**: a newly created category does NOT auto-appear as a chip or on the home panel — the admin adds it via the dropdowns. Every category is always available in the catalog **sidebar** regardless.

### categories.json / conditions.json
Ordered arrays of strings. Defaults:
- categories: `["Lights","Batteries","ABS Pumps","Engine","Gearbox","Suspension"]`
- conditions: `["New","Refurbished","Reclaimed","Tested Used"]`
- Admin can add new ones inline and remove existing ones. **A category/condition cannot be removed while any product still uses it** (the prototype blocks this — enforce server/CMS-side too).

---

## Screens / Views

The site is a single responsive layout with a sticky top nav (Home · Catalog · Contact · Admin link · "Request a quote" button) and a dark footer. Logo mark: a slate hexagon with an orange left edge, wordmark "A&S / AUTO PARTS". Breakpoints: **≤1080px** hero stacks; **≤900px** product/2-col/catalog grids collapse and the catalog filter sidebar becomes a toggle; **≤640px** nav links wrap and the "Admin" text link + some table columns hide.

### 1. Home
- **Purpose:** Communicate what they sell and push to browse / contact with minimal friction.
- **Layout:** Hero is a 3-column grid (`1.22fr 1.2fr .5fr`, 36px gap, align-start):
  - **Left:** eyebrow "GENUINE & QUALITY AFTERMARKET" (orange, 12px, letter-spacing .18em); H1 "The right part, the first time." (Archivo 800, clamp(38–56px), line-height 1.04, letter-spacing -.02em, slate); paragraph (Barlow 400 17px, #5c6770, max-width 480px); a search box + slate "Search" button (52px tall, 9px radius); trust line "✓ Trusted   ✓ Expert support" (500 14px #5c6770); orange CTA "Contact us now to order →" (13px 24px, radius 9px).
  - **Middle:** "Shop by category" panel — light card (`#f7f9fa`, 1px `#eef1f3`, radius 16, padding 18). Header row "Shop by category" + "{N} parts" muted. Rows are the **home categories** (in admin order) + a leading "All parts". Active row = slate fill/white text; inactive = white card w/ hairline. Each row shows name + count. Clicking a row filters the products below and smooth-scrolls to "Browse our parts". **Hidden on mobile (≤640px).**
  - **Right:** contact block, right-aligned: eyebrow "CALL OR EMAIL TO ORDER" (uppercase, .14em, #9aa6ae), phone `0123 456 7890` (Archivo 800 22px, slate, `tel:` link), email `parts@asautoparts.co.uk` (Barlow 600 14px, orange, `mailto:`). On ≤1080px it left-aligns.
- **Below hero:** "Browse our parts" section (H2 Archivo 800 28px) with a result subtitle, an "Open full catalog →" link, a responsive product-card grid (`repeat(auto-fill,minmax(250px,1fr))`, 18px gap), and a numeric pager when needed. Products shown reflect the selected home category. Page size: default 12 (configurable).
- **Contact band:** slate rounded card (radius 18, padding 42) — "Can't find your part?" (Archivo 800 28px white) + subtext + orange "Contact us" button.

### 2. Catalog
- **Purpose:** Browse/search/filter all parts.
- **Layout:** Title "Catalog" (Archivo 800 34px) + "{N} parts · {activeCategoryLabel}" subtitle. Full-width search box. A row of **quick chips** = "All" + the admin-chosen `chipCats` (in order); on mobile a "⚙ Filters" toggle button (slate outline pill, with active-count badge) also appears here.
- Then a **2-column grid** `248px 1fr`, 34px gap:
  - **Left = filter sidebar** (`position:sticky; top:82px`). Heading "Filters" + "Clear all" (orange when active, grey when none). Two **collapsible** sections, each a header row with an uppercase label + a chevron (▾ open / ▸ collapsed), click to toggle:
    - **Category:** "All categories" + every category, with counts. Single-select; active row = slate fill.
    - **Condition:** checkbox rows (custom 18px box, orange when checked w/ ✓), multi-select, with counts. Whole section hidden if `settings.conditionFilter` is false.
  - **Right = results:** a row with "{N} results" + removable active-filter tags (slate pills with ×; category tag + each selected condition). Empty state card ("No parts match your filters" + "ask us to source it" link). Product-card grid (same card as Home). Numeric pager. Default page size 18 (configurable).
- **Mobile (≤900px):** the sidebar is hidden and shown only when the "⚙ Filters" toggle is tapped (`.is-open`), rendered as a bordered card.

### 3. Product detail
- **Purpose:** Show one part in full and drive a contact/quote.
- **Layout:** Breadcrumb (Catalog / Category / Name). 2-column grid `1fr 1fr`, 48px gap:
  - **Left = gallery:** 420px-tall rounded image area (radius 16).
    - 1 image → static. 2+ → **carousel**: left/right circular arrow buttons (42px, white 92% bg, shadow), bottom center dots (8px; active = orange), and a 4-up thumbnail strip below (72px tall, selected = 2px orange outline). 0 images → diagonal-stripe placeholder with a label.
  - **Right = info:** category pill (grey) + condition pill (orange); H1 name (Archivo 800 32px); "Part ref: {sku}" (muted); short description. Then a grey **contact box** (`#f7f9fa`, radius 14, padding 22): eyebrow "CALL OR EMAIL TO ORDER", phone (Archivo 800 24px, `tel:`), email (orange, `mailto:`), a hairline divider, "Interested in this part?" + "Send us your vehicle's make and model and we'll confirm fit, condition and price.", then orange "Request a quote" + outline "Ask a question" buttons (both go to Contact). Then **Specifications** (hidden if no specs): a bordered table of label/value rows.
- **Below:** 2-col `1.4fr 1fr` — **Description** (preserve line breaks) and **Fits** (compatibility list, orange ✓ bullets) + a "Not sure if it fits? Send us your make & model" note.
- **Related:** "More in {category}" — up to 3 cards from the same category, chosen at random (re-shuffled per product view in the prototype). Hidden if none.

### 4. Contact
- **Purpose:** Capture an enquiry; no online ordering.
- **Layout:** Title "Get in touch" (Archivo 800 36px) + intro. 2-col `1.4fr 1fr`:
  - **Left = form** (white card, radius 16, padding 28): Full name, Phone (2-up); Email; **Vehicle make & model** + Part needed (2-up); Message textarea; orange "Send enquiry" button; privacy note. On submit show a success state (checkmark circle, "Enquiry sent", "Send another →"). **There is NO vehicle registration / VIN field — it was intentionally removed. Use "Vehicle make & model" only.**
  - **Right = details** (slate card): Phone, Email, Address (`Unit 5, Example Industrial Estate, Townsville, TS1 2AB`), Opening hours (`Mon–Fri 8:00–18:00 · Sat 9:00–16:00 · Sun closed`). **No embedded map** (intentionally removed). All contact values are placeholders — replace with real details.
- Wire the form to the chosen form service; success/error states should reflect real submission.

### 5. Admin — Product manager
- **Purpose:** Owner manages catalog content + filter configuration. Must be behind auth in production.
- **Layout** (light `#f7f9fa` background): header "Product manager" + count + "+ Add product" (orange).
  - **Catalog filters card** (white): "Quick filter chips" — removable **orange tags** (in added order) + a **dropdown** "+ Add a category as a chip…" (lists only not-yet-chosen categories). Below a hairline: "Show the Condition filter" checkbox toggle.
  - **Home page categories card** (white): removable **slate tags** (in added order) + dropdown "+ Add a category to the home panel…". "All parts" is always implied first.
  - **Search** box (by name, ref, or category).
  - **Product table:** columns Product (48px thumbnail + name + sku) · Category · Condition pill · Actions (Edit outline / Delete red-outline). Category & Condition columns hide on mobile. Empty state row. Numeric pager (8 rows/page in prototype).
- **Add/Edit modal** (centered, max-width 580, radius 16): Name*; Category + Condition selects, each with an inline "+ New" to add a value (and the manage UI allows removing values not in use); Part reference; Short description; Full description; **Product images** block — drag-and-drop reorder, upload (multi), remove ×, first = primary; **Specifications** block — repeatable label/value rows with add/remove (none → section hidden on product page). Cancel / "Save product" (orange).
- In production, "save" commits to the content files; image upload writes to `/uploads` (downscale large images).

---

## Interactions & Behavior
- **Routing:** prototype is a single-page state switch (`home | catalog | product | contact | admin`). In production these are real routes/pages (`/`, `/catalog`, `/product/[slug]`, `/contact`, `/admin`). Preserve scroll-to-top on navigation.
- **Home category click:** sets the active category, resets to page 1, and **smooth-scrolls** to the "Browse our parts" section (custom eased scroll ~460ms; respect `prefers-reduced-motion`).
- **Catalog filtering:** category (single) AND conditions (multi) AND search text (matches name/shortDesc/description, case-insensitive) combine with AND logic. Changing any filter resets to page 1. Active filters appear as removable tags.
- **Collapsible facets:** Category/Condition sections toggle open/closed (chevron ▾/▸).
- **Carousel:** arrows wrap around; dots and thumbnails jump to index; only shown for 2+ images.
- **Pagination:** numeric pages + prev/next; disabled arrows at ends; scroll to top of the list on page change.
- **Admin chips/home/condition changes** update the storefront immediately (in prod: after rebuild).
- **Card hover:** border turns orange + soft shadow (`0 8px 24px rgba(55,71,84,.08)`).
- **Responsive:** see breakpoints above; ensure ≥44px tap targets on mobile.

## State Management
Prototype state (recreate as appropriate per route in production):
- `route`, `activeCategory` (string), `activeConditions` (string[]), `searchQuery`, `filtersOpen` (mobile), `openFacets` ({category,condition}), `homePage`, `catPage`, `adminPage`, `selectedId`, `galleryIndex`, `relatedIds` (random sample per product), `adminSearch`, form draft, and the content collections: `products`, `categories`, `conditions`, `settings`. In production, content collections come from files at build time; only ephemeral UI state (filters, pagination, carousel index, modal) is client-side.

## Design Tokens
- **Colors:** White `#FFFFFF`; primary slate `#374754`; deep slate (footer) `#2D3A45`; accent orange `#FD843B`; body text `#5C6770`; muted `#6B7780` / `#9AA6AE`; hairline `#EEF1F3`; panel bg `#F7F9FA`; input border `#D8DEE3`; light divider `#F1F4F6`; delete-red `#C0392B` on `#F0D4D4` border. Image placeholder = diagonal stripes of `#EEF1F3`/`#E7EBEE`.
- **Typography:** Headings **Archivo** (700/800); body & UI **Barlow** (400/500/600). Both Google Fonts. Eyebrows: uppercase, letter-spacing .12–.22em. H1 letter-spacing -.02em.
- **Radii:** chips/tags 30px (pill); buttons/inputs 8–9px; cards 12–18px; image areas 16px; small thumbs 8–9px.
- **Spacing:** section padding ~44–64px vertical, 5vw horizontal (6vw on mobile); card grids 18px gap; hero gap 36px.
- **Shadow:** card hover `0 8px 24px rgba(55,71,84,.08)`; modal `0 24px 60px rgba(0,0,0,.25)`; carousel arrow `0 2px 8px rgba(0,0,0,.12)`.
- **Buttons:** primary = orange fill/white; secondary = 1.5px `#D8DEE3` border/slate text; search = slate fill.

## Assets
- **Logo:** CSS-only hexagon (slate fill, 3px orange left border) + text wordmark. The owner's real logo (provided separately as the uploaded JPEG) should replace this — request a transparent SVG/PNG for production.
- **Product/hero images:** all placeholders in the prototype (diagonal-stripe boxes). Real photography to be supplied by the owner and managed via the admin.
- **Fonts:** Archivo + Barlow via Google Fonts (self-host for performance/privacy if desired).
- **No icon library** — a few inline unicode glyphs (⌕ search, ✓, ×, ▾/▸, ‹ ›). Swap for the codebase's icon set if preferred.

## Files
- `A&S Auto Parts.dc.html` — the full hi-fi prototype (all screens + admin). Primary reference.
- `Mobile Preview.html` — wraps the prototype in a phone frame for mobile review (not needed in production).
- `Homepage Directions.dc.html` — the three early homepage explorations (context only; direction "A — Clean & Professional" was chosen).
- `support.js` — the prototype's template runtime. **Reference only — do not ship.**

## Screenshots
In `/screenshots` (hi-fi reference captures of the chosen design):
- `01-home.png` — Home: 3-zone hero (headline + search + CTA / Shop-by-category panel / call+email block) and the "Browse our parts" grid.
- `02-catalog.png` — Catalog: search, quick chips, collapsible filter sidebar (Category + Condition), results grid.
- `03-product.png` — Product detail: image carousel (arrows + dots), category/condition pills, the grey call/email + quote box.
- `04-contact.png` — Contact: enquiry form (note: make & model, NO registration) + slate details card (no map).
- `05-admin.png` — Admin "Product manager": Catalog-filters card (chip tags + dropdown, condition toggle) and Home-page-categories card.
- The Add/Edit **product modal** is not screenshotted (overlay doesn't capture cleanly) — it is fully specified under **Screens → Admin → Add/Edit modal**.

## Open items / owner to provide
- Real logo (SVG/PNG, transparent), brand contact details (phone, email, address, hours), and product photos.
- Confirm the form service + recipient email, and the OAuth provider for admin login.
- Decide image strategy (in-repo uploads vs an image CDN) if the catalog will hold many photos.
