import { useParams, useSearchParams } from 'react-router-dom';
import { StoreLayout } from '@/components/store/StoreLayout';
import { ShopifyProductGrid } from '@/components/shopify/ShopifyProductGrid';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';

/**
 * Página de listagem unificada (Shopify).
 * Usa query string `?q=` ou param `:slug` como filtro de busca da Shopify.
 * Funciona para /produtos, /promocoes, /novidades, /mais-vendidos, /tamanho/:size, /categoria/:slug, /busca.
 */
const ProductListingPage = () => {
  const params = useParams<{ slug?: string; size?: string }>();
  const [searchParams] = useSearchParams();
  const path = window.location.pathname;

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
  } else if (params.slug) {
    query = `tag:${params.slug} OR product_type:${params.slug}`;
    title = params.slug.charAt(0).toUpperCase() + params.slug.slice(1).replace(/-/g, ' ');
  } else if (searchParams.get('q')) {
    const q = searchParams.get('q')!;
    query = q;
    title = `Busca: "${q}"`;
  }

  const { data: products, isLoading } = useShopifyProducts({ first: 48, query });

  return (
    <StoreLayout>
      <ShopifyProductGrid
        title={title}
        subtitle={subtitle}
        products={products ?? []}
        isLoading={isLoading}
        emptyTitle="Nenhum produto encontrado"
        emptyDescription="Tente outra categoria ou cadastre produtos no admin Shopify."
      />
    </StoreLayout>
  );
};

export default ProductListingPage;
