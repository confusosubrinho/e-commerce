import { ShopifyProductGrid } from '@/components/shopify/ShopifyProductGrid';
import { useShopifyCollection, useShopifyProductsByHandles } from '@/hooks/useShopifyCollections';
import type { HomeSection } from '@/hooks/useHomeSections';

interface Props {
  section: HomeSection;
}

/**
 * Renderiza uma seção da home cuja origem é a Shopify:
 *  - source_type = 'shopify_collection': busca a coleção pelo handle.
 *  - source_type = 'shopify_manual': busca produtos por uma lista de handles.
 */
export function ShopifyShowcaseSection({ section }: Props) {
  const isCollection = section.source_type === 'shopify_collection';
  const isManual = section.source_type === 'shopify_manual';

  const { data: collection, isLoading: loadingCollection } = useShopifyCollection(
    isCollection ? section.shopify_collection_handle ?? undefined : undefined,
    section.max_items || 12
  );

  const { data: manualProducts, isLoading: loadingManual } = useShopifyProductsByHandles(
    isManual ? section.shopify_product_handles ?? [] : []
  );

  if (!isCollection && !isManual) return null;

  const products = isCollection
    ? (collection?.products?.edges ?? []).slice(0, section.max_items || 12)
    : (manualProducts ?? []);

  const isLoading = isCollection ? loadingCollection : loadingManual;

  const wrapperClass = section.dark_bg ? 'bg-foreground text-background' : '';

  return (
    <div className={wrapperClass}>
      <ShopifyProductGrid
        title={section.title}
        subtitle={section.subtitle || undefined}
        products={products}
        isLoading={isLoading}
        emptyTitle="Sem produtos nesta vitrine"
        emptyDescription={
          isCollection
            ? 'Adicione produtos a essa coleção no admin Shopify.'
            : 'Adicione handles de produtos válidos no admin.'
        }
      />
    </div>
  );
}
