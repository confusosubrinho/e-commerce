import { useQuery } from '@tanstack/react-query';
import { storefrontApiRequest } from '@/lib/shopify/client';
import {
  COLLECTIONS_WITH_PRODUCTS_QUERY,
  COLLECTION_BY_HANDLE_QUERY,
} from '@/lib/shopify/queries';
import type { ShopifyCollection, ShopifyCollectionNode } from '@/lib/shopify/types';

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
