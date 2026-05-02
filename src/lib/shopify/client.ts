import { toast } from 'sonner';

export const SHOPIFY_API_VERSION = '2025-07';
export const SHOPIFY_STORE_PERMANENT_DOMAIN = 'vanessalima-o6a1s.myshopify.com';
export const SHOPIFY_STOREFRONT_TOKEN = '3b50111b61aab29fb14f6ccfa3eb821c';
export const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;
export const SHOPIFY_ADMIN_URL = `https://admin.shopify.com/store/${SHOPIFY_STORE_PERMANENT_DOMAIN.replace('.myshopify.com', '')}`;

interface StorefrontResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string }>;
}

let billingToastShown = false;

/**
 * Helper unificado para chamadas GraphQL ao Storefront API.
 * Trata erros 402 (cobrança Shopify) com toast amigável e retorna undefined.
 */
export async function storefrontApiRequest<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<StorefrontResponse<T> | undefined> {
  const response = await fetch(SHOPIFY_STOREFRONT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 402) {
    if (!billingToastShown) {
      billingToastShown = true;
      toast.error('Loja indisponível', {
        description:
          'A integração Shopify exige um plano ativo. Acesse o admin Shopify para regularizar.',
      });
    }
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`Shopify HTTP ${response.status}`);
  }

  const data = (await response.json()) as StorefrontResponse<T>;
  if (data.errors && data.errors.length > 0) {
    throw new Error(`Shopify GraphQL: ${data.errors.map((e) => e.message).join(', ')}`);
  }
  return data;
}
