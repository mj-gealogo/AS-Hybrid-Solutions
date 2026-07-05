// Data backends for the admin. Both expose the same interface so the UI code
// doesn't care which one is active:
//
//   init()                     -> { products, categories, conditions, settings }
//   putProduct(product)        -> product (with any uploaded image paths applied)
//   removeProduct(product)
//   putSettings(settings)
//   putCategories(categories)
//   putConditions(conditions)
//
// LocalBackend  = browser localStorage (demo mode, used on localhost).
// GitHubBackend = commits to the content files via the GitHub API (production).
import yaml from 'js-yaml';
import { ADMIN_CONFIG } from '../lib/admin-config.js';

export const slugify = (s) =>
  (s || '').toString().toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'product-' + Date.now();

// ---- frontmatter (matches src/lib/content.ts) ----
function parseFrontmatter(raw) {
  const norm = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(norm);
  if (!m) return { data: {}, body: norm.trim() };
  return { data: yaml.load(m[1]) || {}, body: m[2].trim() };
}
function serializeProduct(p) {
  const fm = {
    id: p.id,
    name: p.name,
    category: p.category,
    condition: p.condition,
    sku: p.sku,
    shortDesc: p.shortDesc,
    gallery: p.gallery || [],
    specs: p.specs || [],
    compatibility: p.compatibility || [],
  };
  const y = yaml.dump(fm, { lineWidth: -1, noRefs: true });
  return `---\n${y}---\n\n${(p.description || '').trim()}\n`;
}

// ---- base64 with UTF-8 safety (product copy has en-dashes etc.) ----
function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToUtf8(b64) {
  const bin = atob((b64 || '').replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// =================== LOCAL (demo) ===================
// Saves the whole dataset to localStorage on every change (no publish step).
export function createLocalBackend(seed) {
  const LS = 'as_admin_v1';
  return {
    mode: 'local',
    statusOk: 'Saved locally (demo). Online saving is active on the deployed site.',
    async init() {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(LS)); } catch {}
      return saved && saved.products ? saved : JSON.parse(JSON.stringify(seed));
    },
    save(d) { try { localStorage.setItem(LS, JSON.stringify(d)); } catch {} },
  };
}

// =================== GITHUB (production) ===================
// Reads content via the Contents API; PUBLISHES a whole batch of staged changes
// as a SINGLE commit via the Git Data (Trees) API — so N edits = 1 commit = 1 build.
export function createGitHubBackend(token) {
  const { owner, repo, branch } = ADMIN_CONFIG;
  const contents = `https://api.github.com/repos/${owner}/${repo}/contents`;
  const git = `https://api.github.com/repos/${owner}/${repo}/git`;
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  let repoSlugs = new Set(); // product slugs currently in the repo (for delete safety)

  async function ghGet(url) {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`GitHub ${r.status}: ${await r.text()}`);
    return r.json();
  }
  async function ghSend(method, url, body) {
    const r = await fetch(url, { method, headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`GitHub ${r.status} ${method}: ${await r.text()}`);
    return r.json();
  }
  async function readContent(path) {
    const r = await fetch(`${contents}/${path}?ref=${branch}`, { headers });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub ${r.status} reading ${path}`);
    return b64ToUtf8((await r.json()).content);
  }
  async function readJson(path) {
    const raw = await readContent(path);
    if (raw == null) {
      throw new Error(
        `Could not read ${path} from ${owner}/${repo}@${branch}. ` +
        `Check "owner" and "repo" in src/lib/admin-config.js.`
      );
    }
    return JSON.parse(raw);
  }
  async function listDir(path) {
    const r = await fetch(`${contents}/${path}?ref=${branch}`, { headers });
    if (r.status === 404) return [];
    if (!r.ok) throw new Error(`GitHub ${r.status} listing ${path}`);
    return r.json();
  }
  async function createBlob(content, encoding) {
    return (await ghSend('POST', `${git}/blobs`, { content, encoding })).sha;
  }

  return {
    mode: 'github',
    statusOk: 'Published — committed to GitHub. The live site rebuilds in about a minute.',
    get repoSlugs() { return repoSlugs; },

    async init() {
      // Load the pre-built manifest in ONE request (constant time, any catalog
      // size) instead of one GitHub API call per product. Cache-busting param so
      // we always get the freshest build after a publish.
      const res = await fetch(`/admin/data.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Could not load /admin/data.json (${res.status}). Make sure the site has been deployed with this build.`);
      }
      const data = await res.json();
      repoSlugs = new Set((data.products || []).map((p) => p.slug));
      return data;
    },

    // Bundle every staged change into ONE commit. Returns the number of changes.
    // `pending` = { products:Set<slug>, deletes:Set<slug>, settings, categories, conditions }
    async publish(d, pending) {
      const ref = await ghGet(`${git}/ref/heads/${branch}`);
      const headSha = ref.object.sha;
      const headCommit = await ghGet(`${git}/commits/${headSha}`);
      const baseTree = headCommit.tree.sha;

      const tree = [];

      // Upserted products (+ upload any inline images into the same commit)
      for (const slug of pending.products) {
        const p = d.products.find((x) => x.slug === slug);
        if (!p) continue;
        const gallery = [];
        for (let i = 0; i < (p.gallery || []).length; i++) {
          const g = p.gallery[i];
          const m = g && g.src && /^data:(image\/[\w+.-]+);base64,([\s\S]+)$/.exec(g.src);
          if (m) {
            const ext = m[1].split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
            const fname = `${slug}-${Date.now()}-${i}.${ext}`;
            const sha = await createBlob(m[2], 'base64');
            tree.push({ path: `public/uploads/${fname}`, mode: '100644', type: 'blob', sha });
            gallery.push({ src: `/uploads/${fname}`, label: g.label || '' });
          } else {
            gallery.push({ src: (g && g.src) || null, label: (g && g.label) || '' });
          }
        }
        const sha = await createBlob(utf8ToB64(serializeProduct({ ...p, gallery })), 'base64');
        tree.push({ path: `content/products/${slug}.md`, mode: '100644', type: 'blob', sha });
      }

      // Deletions — only for products that actually exist in the repo
      let deleteCount = 0;
      for (const slug of pending.deletes) {
        if (!repoSlugs.has(slug)) continue;
        tree.push({ path: `content/products/${slug}.md`, mode: '100644', type: 'blob', sha: null });
        deleteCount++;
      }

      if (pending.settings) {
        const sha = await createBlob(utf8ToB64(JSON.stringify(d.settings, null, 2) + '\n'), 'base64');
        tree.push({ path: 'content/settings.json', mode: '100644', type: 'blob', sha });
      }
      if (pending.categories) {
        const sha = await createBlob(utf8ToB64(JSON.stringify(d.categories) + '\n'), 'base64');
        tree.push({ path: 'content/categories.json', mode: '100644', type: 'blob', sha });
      }
      if (pending.conditions) {
        const sha = await createBlob(utf8ToB64(JSON.stringify(d.conditions) + '\n'), 'base64');
        tree.push({ path: 'content/conditions.json', mode: '100644', type: 'blob', sha });
      }

      const changeCount = pending.products.size + deleteCount +
        (pending.settings ? 1 : 0) + (pending.categories ? 1 : 0) + (pending.conditions ? 1 : 0);
      if (tree.length === 0) return 0;

      const newTree = await ghSend('POST', `${git}/trees`, { base_tree: baseTree, tree });
      const commit = await ghSend('POST', `${git}/commits`, {
        message: `Admin: publish ${changeCount} change(s)`,
        tree: newTree.sha,
        parents: [headSha],
      });
      await ghSend('PATCH', `${git}/refs/heads/${branch}`, { sha: commit.sha });

      repoSlugs = new Set(d.products.map((p) => p.slug));
      return changeCount;
    },
  };
}
