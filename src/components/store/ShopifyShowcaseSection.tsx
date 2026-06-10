import { ShopifyProductGrid } from '@/components/shopify/ShopifyProductGrid';
import { useShopifyCollection, useShopifyProductsByHandles } from '@/hooks/useShopifyCollections';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';
import type { HomeSection } from '@/hooks/useHomeSections';

interface Props {
  section: HomeSection;
}

/** Mapeia tipos legados para queries Shopify (fallback). */
function legacyQueryFor(sourceType: HomeSection['source_type']): string | null {
  switch (sourceType) {
    case 'sale':
      return 'tag:sale OR tag:promocao OR tag:promoção';
    case 'featured':
      return 'tag:destaque OR tag:featured';
    case 'new':
      return 'tag:novidade OR tag:new';
    default:
      return null;
  }
}

/**
 * Renderiza uma seção da home. Suporta origens Shopify
 * (shopify_collection / shopify_manual) e tipos legados
 * (featured / sale / new / manual) caindo em queries Shopify.
 */
export function ShopifyShowcaseSection({ section }: Props) {
  const isCollection = section.source_type === 'shopify_collection';
  const isManual = section.source_type === 'shopify_manual';
  const isLegacy = !isCollection && !isManual;
  const max = section.max_items || 12;

  const { data: collection, isLoading: loadingCollection } = useShopifyCollection(
    isCollection ? section.shopify_collection_handle ?? undefined : undefined,
    max
  );

  const { data: manualProducts, isLoading: loadingManual } = useShopifyProductsByHandles(
    isManual ? section.shopify_product_handles ?? [] : []
  );

  const legacyQuery = isLegacy ? legacyQueryFor(section.source_type) : null;
  const { data: legacyProducts, isLoading: loadingLegacy } = useShopifyProducts({
    first: max,
    query: legacyQuery ?? undefined,
    // habilita também para 'manual' legado sem handles (fallback best-sellers)
  });

  const products = isCollection
    ? (collection?.products?.edges ?? []).slice(0, max)
    : isManual
    ? (manualProducts ?? [])
    : (legacyProducts ?? []).slice(0, max);

  const isLoading = isCollection
    ? loadingCollection
    : isManual
    ? loadingManual
    : loadingLegacy;

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
            : isManual
            ? 'Adicione handles de produtos válidos no admin.'
            : 'Configure a vitrine com uma coleção Shopify no admin.'
        }
      />
    </div>
  );
}
