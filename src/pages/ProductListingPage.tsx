import { useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { StoreLayout } from '@/components/store/StoreLayout';
import { ShopifyProductGrid } from '@/components/shopify/ShopifyProductGrid';
import { CategoryFilters, type FilterState } from '@/components/store/CategoryFilters';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';
import { useShopifyCollection } from '@/hooks/useShopifyCollections';
import { PageSEO } from '@/components/seo/PageSEO';
import type { ShopifyProduct } from '@/lib/shopify/types';

const SIZE_OPTION_NAMES = ['tamanho', 'size', 'numeração', 'numeracao'];
const COLOR_OPTION_NAMES = ['cor', 'color', 'colour'];

function deriveFilterOptions(products: ShopifyProduct[]) {
  const sizes = new Set<string>();
  const colors = new Map<string, string | null>();
  let maxPrice = 0;

  for (const p of products) {
    const price = parseFloat(p.node.priceRange.maxVariantPrice.amount);
    if (price > maxPrice) maxPrice = price;

    for (const v of p.node.variants.edges) {
      for (const opt of v.node.selectedOptions) {
        const lower = opt.name.toLowerCase();
        if (SIZE_OPTION_NAMES.includes(lower)) sizes.add(opt.value);
        if (COLOR_OPTION_NAMES.includes(lower) && !colors.has(opt.value)) {
          colors.set(opt.value, null);
        }
      }
    }
  }

  return {
    availableSizes: Array.from(sizes).sort((a, b) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    }),
    availableColors: Array.from(colors.entries()).map(([name, hex]) => ({ name, hex })),
    maxPrice: Math.max(Math.ceil(maxPrice), 100),
  };
}

function productHasSize(p: ShopifyProduct, sizes: string[]) {
  if (sizes.length === 0) return true;
  return p.node.variants.edges.some((v) =>
    v.node.selectedOptions.some(
      (o) => SIZE_OPTION_NAMES.includes(o.name.toLowerCase()) && sizes.includes(o.value),
    ),
  );
}
function productHasColor(p: ShopifyProduct, colors: string[]) {
  if (colors.length === 0) return true;
  return p.node.variants.edges.some((v) =>
    v.node.selectedOptions.some(
      (o) => COLOR_OPTION_NAMES.includes(o.name.toLowerCase()) && colors.includes(o.value),
    ),
  );
}

/** Percentual de desconto do produto (0 quando não está em promoção). */
function getDiscountPercent(p: ShopifyProduct): number {
  const price = parseFloat(p.node.priceRange.minVariantPrice.amount);
  const compare = parseFloat(p.node.compareAtPriceRange?.minVariantPrice?.amount ?? '0');
  if (!compare || !price || compare <= price) return 0;
  return ((compare - price) / compare) * 100;
}

function applyFilters(products: ShopifyProduct[], filters: FilterState): ShopifyProduct[] {
  const filtered = products.filter((p) => {
    const price = parseFloat(p.node.priceRange.minVariantPrice.amount);
    if (price < filters.priceRange[0] || price > filters.priceRange[1]) return false;

    if (filters.onSale && getDiscountPercent(p) <= 0) return false;
    if (filters.isNew) {
      const tags = (p.node.tags ?? []).map((t) => t.toLowerCase());
      if (!tags.includes('novidade') && !tags.includes('new') && !tags.includes('lançamento')) return false;
    }
    if (!productHasSize(p, filters.sizes)) return false;
    if (!productHasColor(p, filters.colors)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const pa = parseFloat(a.node.priceRange.minVariantPrice.amount);
    const pb = parseFloat(b.node.priceRange.minVariantPrice.amount);
    switch (filters.sortBy) {
      case 'discount-desc': {
        const diff = getDiscountPercent(b) - getDiscountPercent(a);
        return diff !== 0 ? diff : pa - pb;
      }
      case 'price-asc':
        return pa - pb;
      case 'price-desc':
        return pb - pa;
      case 'name-asc':
        return a.node.title.localeCompare(b.node.title);
      case 'name-desc':
        return b.node.title.localeCompare(a.node.title);
      case 'oldest':
        return a.node.id.localeCompare(b.node.id);
      case 'newest':
      default:
        return b.node.id.localeCompare(a.node.id);
    }
  });
  return sorted;
}

const ProductListingPage = () => {
  const params = useParams<{ slug?: string; size?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const path = window.location.pathname;

  const isCategoryRoute = path.startsWith('/categoria/') && !!params.slug;
  const isPromoRoute = path.startsWith('/promocoes');

  const { data: collection, isLoading: loadingCollection } = useShopifyCollection(
    isCategoryRoute ? params.slug : undefined,
    48,
  );

  let query: string | undefined;
  let title = 'Produtos';
  let subtitle: string | undefined;

  if (isPromoRoute) {
    // Não dependemos de tags: buscamos um lote maior e detectamos
    // promoção pelo preço comparativo (compareAtPrice) de cada produto.
    query = undefined;
    title = 'Promoções';
    subtitle = 'Todos os produtos com desconto, do maior para o menor';
  } else if (path.startsWith('/novidades')) {
    query = 'tag:novidade OR tag:new';
    title = 'Novidades';
    subtitle = 'Acabou de chegar';
  } else if (path.startsWith('/mais-vendidos')) {
    title = 'Mais vendidos';
    subtitle = 'Os queridinhos da loja';
  } else if (params.size) {
    // Não filtra por tag — a Shopify raramente tem tag tamanho-X.
    // Buscamos um lote maior e filtramos pelas variantes disponíveis client-side.
    query = undefined;
    title = `Tamanho ${params.size}`;
    subtitle = `Produtos disponíveis no tamanho ${params.size}`;
  } else if (searchParams.get('q')) {
    const q = searchParams.get('q')!;
    query = q;
    title = `Busca: "${q}"`;
  }

  const shouldLoadFallback = !isCategoryRoute || (!loadingCollection && !collection);
  const { data: fallbackProducts, isLoading: loadingFallback } = useShopifyProducts({
    first: params.size || isPromoRoute ? 100 : 48,
    query: isCategoryRoute && shouldLoadFallback ? `tag:${params.slug} OR product_type:${params.slug}` : query,
  });

  const baseProducts: ShopifyProduct[] = isCategoryRoute && collection
    ? collection.products?.edges ?? []
    : fallbackProducts ?? [];

  // Para rota /tamanho/:size, manter apenas produtos com variante disponível nesse tamanho
  const rawProducts: ShopifyProduct[] = useMemo(() => {
    if (!params.size) return baseProducts;
    const target = params.size.trim().toLowerCase();
    return baseProducts.filter((p) =>
      p.node.variants.edges.some(
        (v) =>
          v.node.availableForSale &&
          v.node.selectedOptions.some(
            (o) =>
              SIZE_OPTION_NAMES.includes(o.name.toLowerCase()) &&
              o.value.trim().toLowerCase() === target,
          ),
      ),
    );
  }, [baseProducts, params.size]);

  // Em /tamanho/:size derivamos opções a partir de TODOS produtos buscados,
  // assim o sidebar mostra os outros tamanhos disponíveis para navegar.
  const { availableSizes, availableColors, maxPrice } = useMemo(
    () => deriveFilterOptions(params.size ? baseProducts : rawProducts),
    [baseProducts, rawProducts, params.size],
  );

  const handleSizeNavigate = params.size
    ? (size: string) => navigate(`/tamanho/${encodeURIComponent(size)}`)
    : undefined;

  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 5000],
    sizes: params.size ? [params.size] : [],
    colors: [],
    sortBy: isPromoRoute ? 'discount-desc' : 'newest',
    // Na aba Promoções, sempre restringimos aos produtos com desconto real.
    onSale: isPromoRoute,
    isNew: false,
  });

  // Quando maxPrice é descoberto, ajusta limite superior se ainda estiver no default
  const effectiveFilters: FilterState = {
    ...filters,
    priceRange: [
      filters.priceRange[0],
      filters.priceRange[1] === 5000 || filters.priceRange[1] > maxPrice ? maxPrice : filters.priceRange[1],
    ],
  };

  const visibleProducts = useMemo(
    () => applyFilters(rawProducts, effectiveFilters),
    [rawProducts, effectiveFilters],
  );


  const pageTitle =
    isCategoryRoute && collection
      ? collection.title
      : isCategoryRoute && params.slug
        ? params.slug.charAt(0).toUpperCase() + params.slug.slice(1).replace(/-/g, ' ')
        : title;
  const pageSubtitle = isCategoryRoute && collection ? collection.description || undefined : subtitle;
  const isLoading = (isCategoryRoute && loadingCollection) || loadingFallback;

  return (
    <StoreLayout>
      <PageSEO
        title={`${pageTitle} | Vanessa Lima Shoes`}
        description={pageSubtitle || `Confira ${pageTitle.toLowerCase()} na Vanessa Lima Shoes.`}
        noindex={!!searchParams.get('q') || searchParams.toString().length > 0}
      />
      <ShopifyProductGrid
        title={pageTitle}
        subtitle={pageSubtitle}
        products={visibleProducts}
        isLoading={isLoading}
        emptyTitle="Nenhum produto encontrado"
        emptyDescription="Ajuste os filtros ou tente outra categoria."
        sidebar={
          <CategoryFilters
            filters={effectiveFilters}
            onFiltersChange={setFilters}
            availableSizes={availableSizes}
            availableColors={availableColors}
            maxPrice={maxPrice}
            productCount={visibleProducts.length}
            isSidebar
            onSizeClick={handleSizeNavigate}
          />
        }
        toolbar={
          <CategoryFilters
            filters={effectiveFilters}
            onFiltersChange={setFilters}
            availableSizes={availableSizes}
            availableColors={availableColors}
            maxPrice={maxPrice}
            productCount={visibleProducts.length}
            onSizeClick={handleSizeNavigate}
          />
        }
      />
    </StoreLayout>
  );
};

export default ProductListingPage;
