import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

/**
 * Minimal frontmatter parser. Splits a `---`-delimited YAML block from the
 * body and parses it with js-yaml's default safe `load`.
 */
function parseFrontmatter(raw: string): { data: Record<string, any>; content: string } {
  const normalized = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  if (!match) return { data: {}, content: normalized.trim() };
  const data = (yaml.load(match[1]) as Record<string, any>) ?? {};
  return { data, content: match[2] };
}

export interface Spec {
  label: string;
  value: string;
}

export interface GalleryImage {
  src: string;
  label?: string;
}

export interface Product {
  slug: string;
  id: string;
  name: string;
  category: string;
  condition: string;
  sku: string;
  shortDesc: string;
  description: string;
  gallery: GalleryImage[];
  specs: Spec[];
  compatibility: string[];
}

export interface Settings {
  chipCats: string[];
  homeCats: string[];
  conditionFilter: boolean;
}

const contentDir = join(process.cwd(), 'content');

export function loadProducts(): Product[] {
  const dir = join(contentDir, 'products');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  return files.map((file) => {
    const raw = readFileSync(join(dir, file), 'utf-8');
    const { data, content } = parseFrontmatter(raw);
    return {
      slug: file.replace(/\.md$/, ''),
      id: data.id ?? file.replace(/\.md$/, ''),
      name: data.name ?? '',
      category: data.category ?? '',
      condition: data.condition ?? '',
      sku: data.sku ?? '',
      shortDesc: data.shortDesc ?? '',
      description: content.trim(),
      gallery: data.gallery ?? [],
      specs: data.specs ?? [],
      compatibility: data.compatibility ?? [],
    } as Product;
  });
}

export function loadSettings(): Settings {
  const raw = readFileSync(join(contentDir, 'settings.json'), 'utf-8');
  return JSON.parse(raw);
}

export function loadCategories(): string[] {
  const raw = readFileSync(join(contentDir, 'categories.json'), 'utf-8');
  return JSON.parse(raw);
}

export function loadConditions(): string[] {
  const raw = readFileSync(join(contentDir, 'conditions.json'), 'utf-8');
  return JSON.parse(raw);
}
