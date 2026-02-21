import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { StoreLayout } from '@/components/store/StoreLayout';
import { ProductGrid } from '@/components/store/ProductGrid';
import { CategoryFilters, FilterState } from '@/components/store/CategoryFilters';
import { useProducts } from '@/hooks/useProducts';

export default function NewArrivalsPage() {
  const { data: allProducts, isLoading } = useProducts();

  const products = useMemo(() => {
    return allProducts?.filter(p => p.is_new) || [];
  }, [allProducts]);

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

  useMemo(() => {
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

    if (filters.sizes.length > 0) {
      result = result.filter(p => p.variants?.some(v => filters.sizes.includes(v.size) && v.is_active));
    }
    if (filters.colors.length > 0) {
      result = result.filter(p => p.variants?.some(v => v.color && filters.colors.includes(v.color) && v.is_active));
    }
    if (filters.onSale) {
      result = result.filter(p => p.sale_price && p.sale_price < p.base_price);
    }

    switch (filters.sortBy) {
      case 'price-asc': result.sort((a, b) => Number(a.sale_price || a.base_price) - Number(b.sale_price || b.base_price)); break;
      case 'price-desc': result.sort((a, b) => Number(b.sale_price || b.base_price) - Number(a.sale_price || a.base_price)); break;
      case 'name-asc': result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': result.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'oldest': result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      default: result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
    }

    const hasStock = (p: typeof result[0]) => p.variants?.some(v => v.is_active && v.stock_quantity > 0) ?? false;
    result.sort((a, b) => (hasStock(a) ? 0 : 1) - (hasStock(b) ? 0 : 1));

    return result;
  }, [products, filters]);

  return (
    <StoreLayout>
      <div className="bg-muted/30 py-3">
        <div className="container-custom">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">Novidades</span>
          </nav>
        </div>
      </div>

      <div className="bg-muted/30 py-8">
        <div className="container-custom">
          <h1 className="text-3xl font-bold">Novidades</h1>
          <p className="text-muted-foreground mt-2">Os lançamentos mais recentes da loja</p>
        </div>
      </div>

      <div className="container-custom">
        <CategoryFilters filters={filters} onFiltersChange={setFilters} availableSizes={availableSizes} availableColors={availableColors} maxPrice={maxPrice} productCount={filteredProducts.length} />
        <div className="flex flex-col lg:flex-row gap-8 py-8">
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <CategoryFilters filters={filters} onFiltersChange={setFilters} availableSizes={availableSizes} availableColors={availableColors} maxPrice={maxPrice} productCount={filteredProducts.length} isSidebar />
          </aside>
          <main className="flex-1 min-w-0">
            <ProductGrid products={filteredProducts} isLoading={isLoading} />
            {!isLoading && filteredProducts.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-muted-foreground">Nenhuma novidade no momento.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </StoreLayout>
  );
}
