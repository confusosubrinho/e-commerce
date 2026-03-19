import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronRight, Search } from 'lucide-react';
import { StoreLayout } from '@/components/store/StoreLayout';
import { ProductGrid } from '@/components/store/ProductGrid';
import { CategoryFilters, FilterState } from '@/components/store/CategoryFilters';
import { useSearchProducts } from '@/hooks/useProducts';
import { sortProductList, type ProductSortKey } from '@/lib/productSort';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const trimmed = query.trim();
  const { data: products = [], isLoading } = useSearchProducts(trimmed);

  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 1000],
    sizes: [],
    colors: [],
    sortBy: 'newest',
    onSale: false,
    isNew: false,
  });

  const availableSizes = useMemo(() => {
    const sizes = new Set<string>();
    products.forEach(p => p.variants?.forEach(v => { if (v.size && v.is_active) sizes.add(v.size); }));
    return Array.from(sizes).sort((a, b) => Number(a) - Number(b));
  }, [products]);

  const availableColors = useMemo(() => {
    const colorMap = new Map<string, string | null>();
    products.forEach(p => p.variants?.forEach(v => { if (v.color && v.is_active) colorMap.set(v.color, v.color_hex || null); }));
    return Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex }));
  }, [products]);

  const maxPrice = useMemo(() => {
    if (!products.length) return 1000;
    return Math.max(...products.map(p => Number(p.sale_price || p.base_price)));
  }, [products]);

  useEffect(() => {
    if (filters.priceRange[1] === 1000 && maxPrice > 1000) {
      setFilters(prev => ({ ...prev, priceRange: [0, maxPrice] }));
    }
  }, [maxPrice]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    result = result.filter(p => {
      const price = Number(p.sale_price || p.base_price);
      return price >= filters.priceRange[0] && price <= filters.priceRange[1];
    });
    if (filters.sizes.length > 0) result = result.filter(p => p.variants?.some(v => filters.sizes.includes(v.size) && v.is_active));
    if (filters.colors.length > 0) result = result.filter(p => p.variants?.some(v => v.color && filters.colors.includes(v.color) && v.is_active));
    if (filters.onSale) result = result.filter(p => p.sale_price && p.sale_price < p.base_price);
    if (filters.isNew) result = result.filter(p => p.is_new);

    return sortProductList(result, (filters.sortBy || 'newest') as ProductSortKey);
  }, [products, filters]);

  return (
    <StoreLayout>
      <Helmet>
        <title>{trimmed ? `Busca: ${query} | Loja` : 'Busca | Loja'}</title>
        {trimmed && <meta name="description" content={`Resultados da busca por "${query}".`} />}
      </Helmet>
      <div className="bg-muted/30 py-3">
        <div className="container-custom">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">{trimmed ? `Busca: "${query}"` : 'Busca'}</span>
          </nav>
        </div>
      </div>

      <div className="container-custom py-8">
        {!trimmed ? (
          <div className="py-16 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold mb-2">Encontre produtos</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Digite algo na busca (menu ou URL <code className="text-xs bg-muted px-1 rounded">/busca?q=...</code>) para ver os resultados.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">
              Resultados para &quot;{query}&quot;
            </h1>
            <p className="text-muted-foreground mb-2">
              {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
            </p>

            <CategoryFilters
              filters={filters}
              onFiltersChange={setFilters}
              availableSizes={availableSizes}
              availableColors={availableColors}
              maxPrice={maxPrice}
              productCount={filteredProducts.length}
            />

            <div className="flex flex-col lg:flex-row gap-8 py-8">
              <aside className="hidden lg:block w-64 flex-shrink-0">
                <CategoryFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  availableSizes={availableSizes}
                  availableColors={availableColors}
                  maxPrice={maxPrice}
                  productCount={filteredProducts.length}
                  isSidebar
                />
              </aside>

              <main className="flex-1 min-w-0">
                <ProductGrid products={filteredProducts} isLoading={isLoading} />

                {!isLoading && filteredProducts.length === 0 && (
                  <div className="py-16 text-center">
                    <p className="text-muted-foreground">Nenhum produto encontrado para &quot;{query}&quot;.</p>
                  </div>
                )}
              </main>
            </div>
          </>
        )}
      </div>
    </StoreLayout>
  );
}
