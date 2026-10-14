/**
 * Gera dist/produto/<handle>.html e dist/categoria/<handle>.html com as meta tags
 * (título, descrição, imagem) de cada item, para que WhatsApp, Instagram e Facebook,
 * que não executam JavaScript, mostrem a prévia correta. O app carrega igual.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import type { Plugin } from 'vite';
import { SITE_URL, fetchAll } from './shopify-storefront';

const SITE_NAME = 'Vanessa Lima Shoes';
const SAFE_HANDLE = /^[a-z0-9][a-z0-9-]*$/;

const PRODUCTS_QUERY = `
  query PrerenderProducts($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges { node { handle title description featuredImage { url altText } } }
    }
  }
`;

const COLLECTIONS_QUERY = `
  query PrerenderCollections($cursor: String) {
    collections(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges { node { handle title description image { url altText } } }
    }
  }
`;

interface PageMeta {
  path: string;
  title: string;
  description: string;
  image?: { url: string; alt: string };
  type: 'product' | 'website';
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function summarize(text: string | null | undefined, fallback: string): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > 160 ? `${clean.slice(0, 157).trimEnd()}...` : clean;
}

function sizedImage(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('width', '1200');
    return u.toString();
  } catch {
    return url;
  }
}

function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const re = new RegExp(`(<meta[^>]*\\s${attr}="${key.replace(/[.:]/g, '\\$&')}"[^>]*\\scontent=")[^"]*(")`);
  return html.replace(re, `$1${escapeAttr(value)}$2`);
}

function removeMeta(html: string, attr: 'name' | 'property', key: string): string {
  const re = new RegExp(`\\s*<meta[^>]*\\s${attr}="${key.replace(/[.:]/g, '\\$&')}"[^>]*>`);
  return html.replace(re, '');
}

export function renderPage(template: string, meta: PageMeta): string {
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(meta.title)}</title>`);
  html = setMeta(html, 'name', 'description', meta.description);
  html = setMeta(html, 'property', 'og:type', meta.type);
  html = setMeta(html, 'property', 'og:url', SITE_URL + meta.path);
  html = setMeta(html, 'property', 'og:title', meta.title);
  html = setMeta(html, 'name', 'twitter:title', meta.title);
  html = setMeta(html, 'property', 'og:description', meta.description);
  html = setMeta(html, 'name', 'twitter:description', meta.description);
  if (meta.image) {
    const url = sizedImage(meta.image.url);
    html = setMeta(html, 'property', 'og:image', url);
    html = setMeta(html, 'name', 'twitter:image', url);
    html = setMeta(html, 'property', 'og:image:alt', meta.image.alt);
    html = removeMeta(html, 'property', 'og:image:width');
    html = removeMeta(html, 'property', 'og:image:height');
  }
  return html;
}

async function collectPages(): Promise<PageMeta[]> {
  const [products, collections] = await Promise.all([
    fetchAll<{ handle: string; title: string; description: string; featuredImage: { url: string; altText: string | null } | null }>(PRODUCTS_QUERY, 'products'),
    fetchAll<{ handle: string; title: string; description: string; image: { url: string; altText: string | null } | null }>(COLLECTIONS_QUERY, 'collections', 10),
  ]);
  return [
    ...products.map((p): PageMeta => ({
      path: `/produto/${p.handle}`,
      title: `${p.title} | ${SITE_NAME}`,
      description: summarize(p.description, `${p.title} em couro legítimo na ${SITE_NAME}.`),
      image: p.featuredImage ? { url: p.featuredImage.url, alt: p.featuredImage.altText || p.title } : undefined,
      type: 'product',
    })),
    ...collections.map((c): PageMeta => ({
      path: `/categoria/${c.handle}`,
      title: `${c.title} | ${SITE_NAME}`,
      description: summarize(c.description, `${c.title} femininos em couro legítimo na ${SITE_NAME}.`),
      image: c.image ? { url: c.image.url, alt: c.image.altText || c.title } : undefined,
      type: 'website',
    })),
  ].filter((page) => SAFE_HANDLE.test(page.path.split('/').pop() ?? ''));
}

export function socialPrerender(): Plugin {
  let outDir = 'dist';
  return {
    name: 'social-prerender',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const pages = await collectPages();
      if (pages.length === 0) {
        console.warn('[social-prerender] Shopify indisponível; prévias por produto não geradas.');
        return;
      }
      const template = readFileSync(path.join(outDir, 'index.html'), 'utf8');
      for (const page of pages) {
        const file = path.join(outDir, `${page.path.slice(1)}.html`);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, renderPage(template, page));
      }
      console.log(`[social-prerender] ${pages.length} páginas com prévia social geradas.`);
    },
  };
}
