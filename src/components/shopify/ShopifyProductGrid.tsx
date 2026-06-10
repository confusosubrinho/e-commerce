import { ShopifyProductCard } from './ShopifyProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ShoppingBag } from 'lucide-react';
import { useMemo } from 'react';
import type { ShopifyProduct } from '@/lib/shopify/types';
import { SHOPIFY_ADMIN_URL } from '@/lib/shopify/client';

interface Props {
  products: ShopifyProduct[];
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Sidebar slot (filters). When present, grid uses lg:grid-cols-3 layout. */
  sidebar?: React.ReactNode;
  /** Toolbar slot rendered above grid (sort, mobile filters). */
  toolbar?: React.ReactNode;
  /** Renderiza em linha única com scroll horizontal (carrossel). */
  carousel?: boolean;
}

export function ShopifyProductGrid({
  products,
  title,
  subtitle,
  isLoading,
  emptyTitle = 'Nenhum produto cadastrado ainda',
  emptyDescription = 'Cadastre seus produtos no admin Shopify para que eles apareçam na loja.',
  sidebar,
  toolbar,
  carousel = false,
}: Props) {
  // Regra: produtos sem estoque sempre vão para o final.
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const aOut = !a.node.availableForSale ? 1 : 0;
      const bOut = !b.node.availableForSale ? 1 : 0;
      return aOut - bOut;
    });
  }, [products]);

  const grid = (
    <>
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
      ) : sortedProducts.length === 0 ? (
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
      ) : carousel ? (
        <div
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-3 scrollbar-thin"
          style={{ scrollbarWidth: 'thin' }}
        >
          {sortedProducts.map((product) => (
            <div
              key={product.node.id}
              className="snap-start shrink-0 w-[46%] sm:w-[32%] md:w-[24%] lg:w-[19%]"
            >
              <ShopifyProductCard product={product} />
            </div>
          ))}
        </div>
      ) : (
        <div className={`grid grid-cols-2 ${sidebar ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-3 lg:grid-cols-4'} gap-4`}>
          {sortedProducts.map((product) => (
            <ShopifyProductCard key={product.node.id} product={product} />
          ))}
        </div>
      )}
    </>
  );

  return (
    <section className="container-custom py-8 md:py-12">
      {(title || subtitle) && (
        <div className="mb-6 md:mb-8 text-center">
          {title && <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>}
          {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {toolbar}

      {sidebar ? (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 mt-4">
          <aside className="hidden lg:block">
            <div className="sticky top-24">{sidebar}</div>
          </aside>
          <div>{grid}</div>
        </div>
      ) : (
        grid
      )}
    </section>
  );
}
