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
export function createLocalBackend(seed) {
  const LS = 'as_admin_v1';
  let data;
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(data)); } catch {} };
  return {
    mode: 'local',
    statusOk: 'Saved locally (demo). Online saving is active on the deployed site.',
    async init() {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(LS)); } catch {}
      data = saved && saved.products ? saved : JSON.parse(JSON.stringify(seed));
      return data;
    },
    async putProduct(p) { save(); return p; },
    async removeProduct() { save(); },
    async putSettings() { save(); },
    async putCategories() { save(); },
    async putConditions() { save(); },
  };
}

// =================== GITHUB (production) ===================
export function createGitHubBackend(token) {
  const { owner, repo, branch } = ADMIN_CONFIG;
  const base = `https://api.github.com/repos/${owner}/${repo}/contents`;
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  const shas = {}; // path -> latest known blob sha

  async function listDir(path) {
    const r = await fetch(`${base}/${path}?ref=${branch}`, { headers });
    if (r.status === 404) return [];
    if (!r.ok) throw new Error(`GitHub ${r.status} listing ${path}`);
    return r.json();
  }
  async function readFile(path) {
    const r = await fetch(`${base}/${path}?ref=${branch}`, { headers });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub ${r.status} reading ${path}`);
    const j = await r.json();
    shas[path] = j.sha;
    return b64ToUtf8(j.content);
  }
  // Like readFile but fails loudly when the file is missing — so a wrong
  // owner/repo surfaces a clear message instead of a silently-empty admin.
  async function readJson(path) {
    const raw = await readFile(path);
    if (raw == null) {
      throw new Error(
        `Could not read ${path} from ${owner}/${repo}@${branch}. ` +
        `Check "owner" and "repo" in src/lib/admin-config.js.`
      );
    }
    return JSON.parse(raw);
  }
  // contentB64 already base64 (binary) when isBinary; otherwise UTF-8 string.
  async function writeFile(path, content, message, isBinary = false) {
    const body = {
      message, branch,
      content: isBinary ? content : utf8ToB64(content),
    };
    if (shas[path]) body.sha = shas[path];
    const r = await fetch(`${base}/${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`GitHub ${r.status} writing ${path}: ${await r.text()}`);
    const j = await r.json();
    shas[path] = j.content.sha;
  }
  async function deleteFile(path, message) {
    if (!shas[path]) { await readFile(path); if (!shas[path]) return; }
    const body = JSON.stringify({ message, branch, sha: shas[path] });
    const r = await fetch(`${base}/${path}`, { method: 'DELETE', headers, body });
    if (!r.ok) throw new Error(`GitHub ${r.status} deleting ${path}`);
    delete shas[path];
  }

  async function uploadInlineImages(p) {
    const out = [];
    for (let i = 0; i < (p.gallery || []).length; i++) {
      const g = p.gallery[i];
      const m = g && g.src && /^data:(image\/[\w+.-]+);base64,([\s\S]+)$/.exec(g.src);
      if (m) {
        const ext = m[1].split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
        const fname = `${p.slug}-${Date.now()}-${i}.${ext}`;
        await writeFile(`public/uploads/${fname}`, m[2], `Upload image ${fname}`, true);
        out.push({ src: `/uploads/${fname}`, label: g.label || '' });
      } else {
        out.push({ src: (g && g.src) || null, label: (g && g.label) || '' });
      }
    }
    return out;
  }

  return {
    mode: 'github',
    statusOk: 'Saved — committed to GitHub. The live site rebuilds in about a minute.',
    async init() {
      const files = await listDir('content/products');
      const products = [];
      for (const f of files) {
        if (f.type !== 'file' || !f.name.endsWith('.md')) continue;
        const raw = await readFile(f.path);
        const { data, body } = parseFrontmatter(raw);
        products.push({
          slug: f.name.replace(/\.md$/, ''),
          id: data.id ?? f.name.replace(/\.md$/, ''),
          name: data.name ?? '', category: data.category ?? '', condition: data.condition ?? '',
          sku: data.sku ?? '', shortDesc: data.shortDesc ?? '', description: body,
          gallery: data.gallery ?? [], specs: data.specs ?? [], compatibility: data.compatibility ?? [],
        });
      }
      const settings = await readJson('content/settings.json');
      const categories = await readJson('content/categories.json');
      const conditions = await readJson('content/conditions.json');
      return { products, categories, conditions, settings };
    },
    async putProduct(p) {
      const gallery = await uploadInlineImages(p);
      const product = { ...p, gallery };
      await writeFile(`content/products/${p.slug}.md`, serializeProduct(product), `Save product: ${p.name}`);
      return product;
    },
    async removeProduct(p) {
      await deleteFile(`content/products/${p.slug}.md`, `Delete product: ${p.name}`);
    },
    async putSettings(settings) {
      await writeFile('content/settings.json', JSON.stringify(settings, null, 2) + '\n', 'Update catalog settings');
    },
    async putCategories(categories) {
      await writeFile('content/categories.json', JSON.stringify(categories) + '\n', 'Update categories');
    },
    async putConditions(conditions) {
      await writeFile('content/conditions.json', JSON.stringify(conditions) + '\n', 'Update conditions');
    },
  };
}
