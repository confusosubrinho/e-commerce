import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Heart } from 'lucide-react';
import { StoreLayout } from '@/components/store/StoreLayout';
import { ShopifyProductCard } from '@/components/shopify/ShopifyProductCard';
import { useShopifyProduct } from '@/hooks/useShopifyProducts';
import { useShopifyFavoritesStore } from '@/stores/shopifyFavoritesStore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function FavoriteProduct({ handle }: { handle: string }) {
  const { data: product, isLoading, isError } = useShopifyProduct(handle);
  const remove = useShopifyFavoritesStore((s) => s.toggle);
  if (isLoading) return <Skeleton className="aspect-square rounded-lg" />;
  if (product) return <ShopifyProductCard product={{ node: product }} />;
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <p>{isError ? 'Não foi possível carregar este favorito.' : 'Produto indisponível.'}</p>
      <Button variant="outline" onClick={() => remove(handle)}>Remover favorito</Button>
    </div>
  );
}

export default function FavoritesPage() {
  const handles = useShopifyFavoritesStore((s) => s.handles);
  return (
    <StoreLayout>
      <Helmet><title>Meus Favoritos | Loja</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="container-custom py-8">
        <h1 className="text-2xl font-bold mb-2">Meus Favoritos</h1>
        <p className="text-muted-foreground mb-6">Salvos neste navegador.</p>
        {handles.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {handles.map((handle) => <FavoriteProduct key={handle} handle={handle} />)}
          </div>
        ) : (
          <div className="text-center py-16 space-y-4">
            <Heart className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Nenhum favorito ainda</h2>
            <p>Explore os produtos e toque no coração para salvar.</p>
            <Button asChild><Link to="/">Explorar produtos</Link></Button>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
