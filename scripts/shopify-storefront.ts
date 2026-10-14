// Acesso à Shopify Storefront API para scripts de build (sitemap e prévias sociais).
export const SITE_URL = 'https://vanessalimashoes.com.br';

const SHOPIFY_API_VERSION = '2025-07';
const SHOPIFY_STORE_PERMANENT_DOMAIN = 'vanessalima-o6a1s.myshopify.com';
const SHOPIFY_STOREFRONT_TOKEN = '3b50111b61aab29fb14f6ccfa3eb821c';
const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

export async function storefront<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(SHOPIFY_STOREFRONT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}

type Connection<N> = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  edges: { node: N }[];
};

/** Percorre todas as páginas de uma conexão `products`/`collections`. */
export async function fetchAll<N>(query: string, key: 'products' | 'collections', maxPages = 20): Promise<N[]> {
  const nodes: N[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const data: Record<string, Connection<N>> | null = await storefront(query, { cursor });
    const conn = data?.[key];
    if (!conn) break;
    nodes.push(...conn.edges.map((e) => e.node));
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  return nodes;
}
