import { useQuery } from '@tanstack/react-query';
import { storefrontApiRequest } from '@/lib/shopify/client';
import {
  PRODUCT_BY_HANDLE_QUERY,
  PRODUCTS_QUERY,
  PRODUCT_RECOMMENDATIONS_QUERY,
} from '@/lib/shopify/queries';
import type { ShopifyProduct, ShopifyProductNode } from '@/lib/shopify/types';

interface UseShopifyProductsOptions {
  first?: number;
  query?: string;
}

/** Lista produtos da Shopify (com filtro opcional de busca/tags). */
export function useShopifyProducts(opts: UseShopifyProductsOptions = {}) {
  const { first = 24, query } = opts;
  return useQuery({
    queryKey: ['shopify-products', first, query ?? null],
    queryFn: async () => {
      const data = await storefrontApiRequest<{
        products: { edges: ShopifyProduct[] };
      }>(PRODUCTS_QUERY, { first, query: query ?? null });
      return data?.data?.products?.edges ?? [];
    },
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
