import { Link } from 'react-router-dom';
import { ShopifyProductCard } from './ShopifyProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ShoppingBag } from 'lucide-react';
import type { ShopifyProduct } from '@/lib/shopify/types';
import { SHOPIFY_ADMIN_URL } from '@/lib/shopify/client';

interface Props {
  products: ShopifyProduct[];
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ShopifyProductGrid({
  products,
  title,
  subtitle,
  isLoading,
  emptyTitle = 'Nenhum produto cadastrado ainda',
  emptyDescription = 'Cadastre seus produtos no admin Shopify para que eles apareçam na loja.',
}: Props) {
  return (
    <section className="container-custom py-8 md:py-12">
      {(title || subtitle) && (
        <div className="mb-6 md:mb-8 text-center">
          {title && <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>}
          {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/30">
          <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">{emptyTitle}</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{emptyDescription}</p>
          <Button asChild variant="outline" className="mt-4">
            <a href={SHOPIFY_ADMIN_URL} target="_blank" rel="noopener noreferrer">
              Abrir admin Shopify
            </a>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ShopifyProductCard key={product.node.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}
