import { useQuery } from '@tanstack/react-query';
import { storefrontApiRequest } from '@/lib/shopify/client';
import {
  PRODUCT_BY_HANDLE_QUERY,
  PRODUCTS_QUERY,
  PRODUCT_RECOMMENDATIONS_QUERY,
} from '@/lib/shopify/queries';
import type { ShopifyProduct, ShopifyProductNode } from '@/lib/shopify/types';

export type ShopifyProductSortKey =
  | 'BEST_SELLING'
  | 'CREATED_AT'
  | 'PRICE'
  | 'TITLE'
  | 'UPDATED_AT'
  | 'RELEVANCE';

interface UseShopifyProductsOptions {
  first?: number;
  query?: string;
  sortKey?: ShopifyProductSortKey;
  reverse?: boolean;
  enabled?: boolean;
}

/** Lista produtos da Shopify (com filtro opcional de busca/tags). */
export function useShopifyProducts(opts: UseShopifyProductsOptions = {}) {
  const { first = 24, query, sortKey = 'BEST_SELLING', reverse = false, enabled = true } = opts;
  return useQuery({
    queryKey: ['shopify-products', first, query ?? null, sortKey, reverse],
    queryFn: async () => {
      const data = await storefrontApiRequest<{
        products: { edges: ShopifyProduct[] };
      }>(PRODUCTS_QUERY, { first, query: query ?? null, sortKey, reverse });
      return data?.data?.products?.edges ?? [];
    },
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

/** Busca um produto pelo handle (slug Shopify). */
export function useShopifyProduct(handle: string | undefined) {
  return useQuery({
    queryKey: ['shopify-product', handle],
    queryFn: async (): Promise<ShopifyProductNode | null> => {
      if (!handle) return null;
      const data = await storefrontApiRequest<{ product: ShopifyProductNode | null }>(
        PRODUCT_BY_HANDLE_QUERY,
        { handle }
      );
      return data?.data?.product ?? null;
    },
    enabled: !!handle,
    staleTime: 1000 * 60 * 2,
  });
}

/** Produtos recomendados pela Shopify (relacionados). */
export function useShopifyProductRecommendations(productId: string | undefined) {
  return useQuery({
    queryKey: ['shopify-product-recommendations', productId],
    queryFn: async () => {
      if (!productId) return [];
      const data = await storefrontApiRequest<{
        productRecommendations: ShopifyProductNode[] | null;
      }>(PRODUCT_RECOMMENDATIONS_QUERY, { productId });
      const list = data?.data?.productRecommendations ?? [];
      // Normalizar para o mesmo shape de ShopifyProduct ({ node }) usado pelo grid
      return list.map((node) => ({ node })) as { node: ShopifyProductNode }[];
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 5,
  });
}
