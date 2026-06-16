import { ShopifyProductCard } from './ShopifyProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ShopifyProduct } from '@/lib/shopify/types';
import { SHOPIFY_ADMIN_URL } from '@/lib/shopify/client';
import { useDragScroll } from '@/hooks/useDragScroll';
import { useHorizontalScrollAxisLock } from '@/hooks/useHorizontalScrollAxisLock';
import { cn } from '@/lib/utils';

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
        <CarouselScroller products={sortedProducts} />
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

function CarouselScroller({ products }: { products: ShopifyProduct[] }) {
  const dragRef = useDragScroll();
  const axisLockRef = useHorizontalScrollAxisLock();
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      (dragRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      (axisLockRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    },
    [dragRef, axisLockRef],
  );

  const elRef = useRef<HTMLDivElement | null>(null);

  const updateButtons = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 2);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  const attachRef = useCallback(
    (el: HTMLDivElement | null) => {
      elRef.current = el;
      setRefs(el);
    },
    [setRefs],
  );

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    updateButtons();
    el.addEventListener('scroll', updateButtons, { passive: true });
    const ro = new ResizeObserver(updateButtons);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateButtons);
      ro.disconnect();
    };
  }, [updateButtons, products.length]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = elRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  return (
    <div className="relative group">
      <div
        ref={attachRef}
        className={cn(
          'flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-3 select-none cursor-grab active:cursor-grabbing',
          '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {products.map((product) => (
          <div
            key={product.node.id}
            className="snap-start shrink-0 w-[46%] sm:w-[32%] md:w-[24%] lg:w-[19%]"
          >
            <ShopifyProductCard product={product} />
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Anterior"
        onClick={() => scrollByPage(-1)}
        className={cn(
          'hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur border border-border/50 transition-opacity hover:bg-background',
          canPrev ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Próximo"
        onClick={() => scrollByPage(1)}
        className={cn(
          'hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur border border-border/50 transition-opacity hover:bg-background',
          canNext ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
