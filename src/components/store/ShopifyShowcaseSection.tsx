import { useMemo } from 'react';
import { ShopifyProductGrid } from '@/components/shopify/ShopifyProductGrid';
import { useShopifyCollection, useShopifyProductsByHandles } from '@/hooks/useShopifyCollections';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';
import type { HomeSection } from '@/hooks/useHomeSections';
import type { ShopifyProduct } from '@/lib/shopify/types';

interface Props {
  section: HomeSection;
}

/** Tipo legado → query Shopify por tags. */
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

/** Heurística: produto está em promoção quando compareAtPrice > price. */
function hasDiscount(p: ShopifyProduct): boolean {
  const cmp = Number(p.node.compareAtPriceRange?.minVariantPrice?.amount ?? '0');
  const price = Number(p.node.priceRange?.minVariantPrice?.amount ?? '0');
  return cmp > 0 && cmp > price;
}

/**
 * Renderiza uma seção da home. Suporta:
 *  - shopify_collection: coleção pelo handle
 *  - shopify_manual: lista de handles
 *  - legados (sale/featured/new/manual): tenta tags e cai em fallback
 *    automático (descontos / mais recentes / mais vendidos).
 */
export function ShopifyShowcaseSection({ section }: Props) {
  const isCollection = section.source_type === 'shopify_collection';
  const isManual = section.source_type === 'shopify_manual';
  const isLegacy = !isCollection && !isManual;
  const max = section.max_items || 12;
  const isCarousel = section.section_type === 'carousel';

  const { data: collection, isLoading: loadingCollection } = useShopifyCollection(
    isCollection ? section.shopify_collection_handle ?? undefined : undefined,
    max
  );

  const { data: manualProducts, isLoading: loadingManual } = useShopifyProductsByHandles(
    isManual ? section.shopify_product_handles ?? [] : []
  );

  // 1) Tentativa por tags (quando legado)
  const legacyTagQuery = isLegacy ? legacyQueryFor(section.source_type) : null;
  const { data: tagProducts, isLoading: loadingTag } = useShopifyProducts({
    first: max,
    query: legacyTagQuery ?? undefined,
    enabled: isLegacy && !!legacyTagQuery,
  });

  // 2) Fallback para "sale": busca um pool maior e filtra por compareAtPrice
  const needsSaleFallback =
    isLegacy && section.source_type === 'sale' && !loadingTag && (tagProducts ?? []).length === 0;
  const { data: salePool, isLoading: loadingSale } = useShopifyProducts({
    first: 50,
    sortKey: 'BEST_SELLING',
    enabled: needsSaleFallback,
  });

  // 3) Fallback para "new": produtos mais recentes (CREATED_AT desc)
  const needsNewFallback =
    isLegacy && section.source_type === 'new' && !loadingTag && (tagProducts ?? []).length === 0;
  const { data: newest, isLoading: loadingNew } = useShopifyProducts({
    first: max,
    sortKey: 'CREATED_AT',
    reverse: true,
    enabled: needsNewFallback,
  });

  // 4) Fallback genérico para "manual"/"featured" legado sem tags: best sellers
  const needsBestSellersFallback =
    isLegacy &&
    !legacyTagQuery &&
    section.source_type !== 'new' &&
    section.source_type !== 'sale';
  const { data: bestSellers, isLoading: loadingBest } = useShopifyProducts({
    first: max,
    sortKey: 'BEST_SELLING',
    enabled: needsBestSellersFallback,
  });

  const products = useMemo<ShopifyProduct[]>(() => {
    if (isCollection) return (collection?.products?.edges ?? []).slice(0, max);
    if (isManual) return manualProducts ?? [];
    if ((tagProducts ?? []).length > 0) return (tagProducts ?? []).slice(0, max);
    if (needsSaleFallback) return (salePool ?? []).filter(hasDiscount).slice(0, max);
    if (needsNewFallback) return (newest ?? []).slice(0, max);
    if (needsBestSellersFallback) return (bestSellers ?? []).slice(0, max);
    return [];
  }, [
    isCollection,
    isManual,
    collection,
    manualProducts,
    tagProducts,
    salePool,
    newest,
    bestSellers,
    needsSaleFallback,
    needsNewFallback,
    needsBestSellersFallback,
    max,
  ]);

  const isLoading = isCollection
    ? loadingCollection
    : isManual
    ? loadingManual
    : loadingTag || loadingSale || loadingNew || loadingBest;

  const wrapperClass = section.dark_bg ? 'bg-foreground text-background' : '';

  return (
    <div className={wrapperClass}>
      <ShopifyProductGrid
        title={section.title}
        subtitle={section.subtitle || undefined}
        products={products}
        isLoading={isLoading}
        carousel={isCarousel}
        emptyTitle="Sem produtos nesta vitrine"
        emptyDescription={
          isCollection
            ? 'Adicione produtos a essa coleção no admin Shopify.'
            : isManual
            ? 'Adicione handles de produtos válidos no admin.'
            : 'Cadastre produtos na Shopify para preencher esta vitrine.'
        }
      />
    </div>
  );
}
