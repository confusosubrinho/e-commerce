import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';
import { useHorizontalScrollAxisLock } from '@/hooks/useHorizontalScrollAxisLock';

const SIZE_OPTION_NAMES = ['tamanho', 'size', 'numeração', 'numeracao'];

export function ShopBySize() {
  const scrollRef = useHorizontalScrollAxisLock();
  const { data: products } = useShopifyProducts({ first: 100, sortKey: 'BEST_SELLING' });

  const sizes = useMemo(() => {
    const available = new Set<string>();

    for (const product of products ?? []) {
      for (const variant of product.node.variants.edges) {
        if (!variant.node.availableForSale) continue;
        for (const option of variant.node.selectedOptions) {
          if (!SIZE_OPTION_NAMES.includes(option.name.toLowerCase())) continue;
          const value = option.value.trim();
          if (value) available.add(value);
        }
      }
    }

    return Array.from(available).sort((a, b) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [products]);

  if (sizes.length === 0) return null;

  return (
    <section className="py-12">
      <div className="container-custom">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">Compre por Tamanho</h2>
          <p className="text-muted-foreground mt-1">Encontre seu número perfeito</p>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide justify-start md:justify-center pb-2 cursor-grab active:cursor-grabbing"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {sizes.map((size) => (
            <Link
              key={size}
              to={`/tamanho/${encodeURIComponent(size)}`}
              className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-foreground text-foreground font-bold text-lg hover:bg-foreground hover:text-background transition-colors flex-shrink-0"
            >
              {size}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
