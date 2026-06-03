import { useQuery } from '@tanstack/react-query';
import { storefrontApiRequest } from '@/lib/shopify/client';
import {
  COLLECTIONS_WITH_PRODUCTS_QUERY,
  COLLECTION_BY_HANDLE_QUERY,
  PRODUCTS_QUERY,
} from '@/lib/shopify/queries';
import type { ShopifyCollection, ShopifyCollectionNode, ShopifyProduct } from '@/lib/shopify/types';

interface UseShopifyCollectionsOptions {
  first?: number;
  productsPerCollection?: number;
}

/** Lista todas as coleções da Shopify com uma prévia de produtos (para o mega menu). */
export function useShopifyCollections(opts: UseShopifyCollectionsOptions = {}) {
  const { first = 30, productsPerCollection = 4 } = opts;
  return useQuery({
    queryKey: ['shopify-collections', first, productsPerCollection],
    queryFn: async () => {
      const data = await storefrontApiRequest<{
        collections: { edges: ShopifyCollection[] };
      }>(COLLECTIONS_WITH_PRODUCTS_QUERY, { first, productsPerCollection });
      return data?.data?.collections?.edges ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

/** Busca uma coleção da Shopify pelo handle, com seus produtos. */
export function useShopifyCollection(handle: string | undefined, first = 48) {
  return useQuery({
    queryKey: ['shopify-collection', handle, first],
    queryFn: async (): Promise<ShopifyCollectionNode | null> => {
      if (!handle) return null;
      const data = await storefrontApiRequest<{ collection: ShopifyCollectionNode | null }>(
        COLLECTION_BY_HANDLE_QUERY,
        { handle, first }
      );
      return data?.data?.collection ?? null;
    },
    enabled: !!handle,
    staleTime: 1000 * 60 * 2,
  });
}

/** Busca múltiplos produtos por uma lista de handles (vitrine manual). */
export function useShopifyProductsByHandles(handles: string[] | undefined) {
  const cleanHandles = (handles ?? []).map(h => h.trim()).filter(Boolean);
  return useQuery({
    queryKey: ['shopify-products-by-handles', cleanHandles.join(',')],
    queryFn: async (): Promise<ShopifyProduct[]> => {
      if (cleanHandles.length === 0) return [];
      const query = cleanHandles.map(h => `handle:${h}`).join(' OR ');
      const data = await storefrontApiRequest<{
        products: { edges: ShopifyProduct[] };
      }>(PRODUCTS_QUERY, { first: Math.min(cleanHandles.length, 50), query });
      const edges = data?.data?.products?.edges ?? [];
      // Preserva a ordem dos handles informados
      const byHandle = new Map(edges.map(e => [e.node.handle, e]));
      return cleanHandles.map(h => byHandle.get(h)).filter(Boolean) as ShopifyProduct[];
    },
    enabled: cleanHandles.length > 0,
    staleTime: 1000 * 60 * 2,
  });
}
