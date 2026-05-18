import { useParams, useSearchParams } from 'react-router-dom';
import { StoreLayout } from '@/components/store/StoreLayout';
import { ShopifyProductGrid } from '@/components/shopify/ShopifyProductGrid';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';
import { useShopifyCollection } from '@/hooks/useShopifyCollections';

/**
 * Página de listagem unificada (Shopify).
 * - /categoria/:slug → busca pela COLEÇÃO Shopify cujo handle = slug
 * - /tamanho/:size, /promocoes, /novidades, /mais-vendidos → query por tag/product_type
 * - /busca?q= → busca livre
 */
const ProductListingPage = () => {
  const params = useParams<{ slug?: string; size?: string }>();
  const [searchParams] = useSearchParams();
  const path = window.location.pathname;

  const isCategoryRoute = path.startsWith('/categoria/') && !!params.slug;

  // Coleção Shopify (apenas em /categoria/:slug)
  const { data: collection, isLoading: loadingCollection } = useShopifyCollection(
    isCategoryRoute ? params.slug : undefined,
    48
  );

  // Fallback / outras rotas: query por tag/product_type/busca
  let query: string | undefined;
  let title = 'Produtos';
  let subtitle: string | undefined;

  if (path.startsWith('/promocoes')) {
    query = 'tag:promocao OR tag:sale';
    title = 'Promoções';
    subtitle = 'Ofertas especiais';
  } else if (path.startsWith('/novidades')) {
    query = 'tag:novidade OR tag:new';
    title = 'Novidades';
    subtitle = 'Acabou de chegar';
  } else if (path.startsWith('/mais-vendidos')) {
    title = 'Mais vendidos';
    subtitle = 'Os queridinhos da loja';
  } else if (params.size) {
    query = `tag:tamanho-${params.size}`;
    title = `Tamanho ${params.size}`;
  } else if (searchParams.get('q')) {
    const q = searchParams.get('q')!;
    query = q;
    title = `Busca: "${q}"`;
  }

  // Em /categoria/:slug, só carrega o fallback se a coleção não existir.
  const shouldLoadFallback = !isCategoryRoute || (!loadingCollection && !collection);
  const { data: fallbackProducts, isLoading: loadingFallback } = useShopifyProducts({
    first: 48,
    query: isCategoryRoute && shouldLoadFallback ? `tag:${params.slug} OR product_type:${params.slug}` : query,
  });

  if (isCategoryRoute && collection) {
    const products = collection.products?.edges ?? [];
    return (
      <StoreLayout>
        <ShopifyProductGrid
          title={collection.title}
          subtitle={collection.description || undefined}
          products={products}
          isLoading={loadingCollection}
          emptyTitle="Nenhum produto nesta coleção"
          emptyDescription="Adicione produtos a esta coleção no admin Shopify."
        />
      </StoreLayout>
    );
  }

  const finalTitle = isCategoryRoute && params.slug
    ? params.slug.charAt(0).toUpperCase() + params.slug.slice(1).replace(/-/g, ' ')
    : title;

  return (
    <StoreLayout>
      <ShopifyProductGrid
        title={finalTitle}
        subtitle={subtitle}
        products={fallbackProducts ?? []}
        isLoading={loadingFallback || (isCategoryRoute && loadingCollection)}
        emptyTitle="Nenhum produto encontrado"
        emptyDescription="Tente outra categoria ou cadastre produtos no admin Shopify."
      />
    </StoreLayout>
  );
};

export default ProductListingPage;
