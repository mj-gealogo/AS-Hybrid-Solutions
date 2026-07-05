import type { APIRoute } from 'astro';
import { loadProducts, loadSettings, loadCategories, loadConditions } from '../../lib/content';

// Build-time manifest of all content, served as ONE static file at /admin/data.json.
// The admin (GitHub mode) loads this instead of making one API call per product,
// so initial load is fast and constant regardless of how many products exist.
// Contains only data already public on the storefront — no secrets. It also sits
// under /admin/, so Cloudflare Access gates it alongside the admin page.
export const GET: APIRoute = () => {
  const products = loadProducts().map((p) => ({
    id: p.id, slug: p.slug, name: p.name, category: p.category, condition: p.condition,
    sku: p.sku, shortDesc: p.shortDesc, description: p.description,
    gallery: p.gallery, specs: p.specs, compatibility: p.compatibility,
  }));
  const body = JSON.stringify({
    products,
    categories: loadCategories(),
    conditions: loadConditions(),
    settings: loadSettings(),
  });
  return new Response(body, { headers: { 'Content-Type': 'application/json' } });
};
