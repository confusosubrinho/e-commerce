/**
 * Gera public/sitemap.xml antes de `vite dev` e `vite build` (hooks predev/prebuild).
 *
 * Fonte dos dados: Shopify Storefront API (mesma origem usada pela loja).
 * Só entram URLs públicas e indexáveis — carrinho, checkout, conta, admin,
 * busca e URLs com parâmetros ficam de fora.
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { SITE_URL, fetchAll } from './shopify-storefront';

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
  image?: { loc: string; title?: string };
}

/** Rotas públicas estáticas da loja (ver src/App.tsx). */
const STATIC_ENTRIES: SitemapEntry[] = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/novidades', changefreq: 'daily', priority: '0.8' },
  { path: '/promocoes', changefreq: 'daily', priority: '0.8' },
  { path: '/mais-vendidos', changefreq: 'weekly', priority: '0.8' },
  { path: '/sobre', changefreq: 'monthly', priority: '0.5' },
  { path: '/faq', changefreq: 'monthly', priority: '0.5' },
  { path: '/como-comprar', changefreq: 'monthly', priority: '0.5' },
  { path: '/formas-pagamento', changefreq: 'monthly', priority: '0.5' },
  { path: '/trocas', changefreq: 'monthly', priority: '0.5' },
  { path: '/politica-privacidade', changefreq: 'yearly', priority: '0.3' },
  { path: '/termos', changefreq: 'yearly', priority: '0.3' },
  { path: '/atendimento', changefreq: 'monthly', priority: '0.5' },
  { path: '/blog', changefreq: 'weekly', priority: '0.5' },
];

const PRODUCTS_QUERY = `
  query SitemapProducts($cursor: String) {
    products(first: 250, after: $cursor, query: "available_for_sale:true") {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          handle
          title
          updatedAt
          featuredImage { url }
        }
      }
    }
  }
`;

const COLLECTIONS_QUERY = `
  query SitemapCollections($cursor: String) {
    collections(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges { node { handle updatedAt } }
    }
  }
`;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchProducts(): Promise<SitemapEntry[]> {
  const nodes = await fetchAll<{ handle: string; title: string; updatedAt: string; featuredImage: { url: string } | null }>(
    PRODUCTS_QUERY,
    'products',
  );
  return nodes.map((node) => ({
    path: `/produto/${node.handle}`,
    lastmod: node.updatedAt,
    changefreq: 'weekly',
    priority: '0.9',
    image: node.featuredImage?.url ? { loc: node.featuredImage.url, title: node.title } : undefined,
  }));
}

async function fetchCollections(): Promise<SitemapEntry[]> {
  const nodes = await fetchAll<{ handle: string; updatedAt: string }>(COLLECTIONS_QUERY, 'collections', 10);
  return nodes.map((node) => ({
    path: `/categoria/${node.handle}`,
    lastmod: node.updatedAt,
    changefreq: 'weekly',
    priority: '0.7',
  }));
}

function generateSitemap(entries: SitemapEntry[]): string {
  const urls = entries.map((e) =>
    [
      '  <url>',
      `    <loc>${xmlEscape(SITE_URL + e.path)}</loc>`,
      e.lastmod ? `    <lastmod>${new Date(e.lastmod).toISOString()}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      e.image
        ? [
            '    <image:image>',
            `      <image:loc>${xmlEscape(e.image.loc)}</image:loc>`,
            e.image.title ? `      <image:title>${xmlEscape(e.image.title)}</image:title>` : null,
            '    </image:image>',
          ]
            .filter(Boolean)
            .join('\n')
        : null,
      '  </url>',
    ]
      .filter(Boolean)
      .join('\n')
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls,
    '</urlset>',
  ].join('\n');
}

async function main() {
  const [products, collections] = await Promise.all([fetchProducts(), fetchCollections()]);

  const seen = new Set<string>();
  const entries = [...STATIC_ENTRIES, ...collections, ...products].filter((e) => {
    if (e.path.includes('?') || seen.has(e.path)) return false;
    seen.add(e.path);
    return true;
  });

  writeFileSync(resolve('public/sitemap.xml'), generateSitemap(entries));
  console.log(
    `sitemap.xml gerado (${entries.length} URLs: ${STATIC_ENTRIES.length} estáticas, ${collections.length} categorias, ${products.length} produtos)`
  );
}

main();
