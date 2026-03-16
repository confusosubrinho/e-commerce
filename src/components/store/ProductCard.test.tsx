/**
 * Teste de componente: ProductCard renderiza nome e preço com dados mínimos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductCard } from './ProductCard';
import type { Product } from '@/types/database';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/useFavorites', () => ({
  useFavorites: () => ({
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/usePricingConfig', () => ({
  usePricingConfig: () => ({
    data: {
      pix_discount: 5,
      pix_discount_applies_to_sale_products: true,
      max_installments: 6,
      interest_free_installments: 3,
      min_installment_value: 25,
    },
  }),
}));

vi.mock('@/hooks/useProducts', () => ({
  useStoreSettings: () => ({ data: { show_variants_on_grid: true } }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { avg: 0, count: 0 } }),
}));

vi.mock('@/hooks/useHorizontalScrollAxisLock', () => ({
  useHorizontalScrollAxisLock: () => ({ current: null }),
}));

vi.mock('@/hooks/useInView', () => ({
  useInView: () => ({ ref: vi.fn(), inView: true }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })) })) },
}));

vi.mock('@/components/store/VariantSelectorModal', () => ({
  VariantSelectorModal: () => null,
}));

function minimalProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-e2e-1',
    name: 'Produto Teste E2E',
    slug: 'produto-teste-e2e',
    description: null,
    base_price: 99.9,
    sale_price: null,
    cost: null,
    sku: null,
    category_id: null,
    is_active: true,
    is_featured: false,
    is_new: false,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    weight: null,
    width: null,
    height: null,
    depth: null,
    gtin: null,
    mpn: null,
    brand: null,
    condition: null,
    google_product_category: null,
    age_group: null,
    gender: null,
    material: null,
    pattern: null,
    seo_title: null,
    seo_description: null,
    seo_keywords: null,
    images: [{ id: 'img1', product_id: 'prod-e2e-1', url: '/img.jpg', alt_text: null, display_order: 0, is_primary: true, created_at: '2025-01-01T00:00:00Z' }],
    variants: [{ id: 'v1', product_id: 'prod-e2e-1', size: 'M', color: null, color_hex: null, stock_quantity: 10, price_modifier: 0, base_price: null, sale_price: null, sku: null, is_active: true, created_at: '2025-01-01T00:00:00Z' }],
    ...overrides,
  };
}

describe('ProductCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza nome do produto', () => {
    const product = minimalProduct({ name: 'Camiseta Básica' });
    render(<ProductCard product={product} />);
    expect(screen.getByText('Camiseta Básica')).toBeInTheDocument();
  });

  it('exibe preço formatado em BRL', () => {
    const product = minimalProduct({ base_price: 199.9 });
    render(<ProductCard product={product} />);
    // formatCurrency(199.9) em pt-BR => R$ 199,90 (ou com NBSP)
    expect(screen.getByText(/R\$\s*199,90/)).toBeInTheDocument();
  });

  it('renderiza link para a página do produto', () => {
    const product = minimalProduct({ slug: 'meu-produto' });
    render(<ProductCard product={product} />);
    const link = screen.getByRole('link', { name: /produto teste e2e/i });
    expect(link).toHaveAttribute('href', '/produto/meu-produto');
  });
});
