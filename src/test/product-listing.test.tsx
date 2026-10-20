import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import ProductListingPage from '@/pages/ProductListingPage';
import type { FilterState } from '@/components/store/CategoryFilters';
import type { ShopifyProduct } from '@/lib/shopify/types';

const { productsHook, retry } = vi.hoisted(() => ({ productsHook: vi.fn(), retry: vi.fn() }));
vi.mock('@/hooks/useShopifyProducts', () => ({ useShopifyProducts: productsHook }));
vi.mock('@/hooks/useShopifyCollections', () => ({ useShopifyCollection: () => ({ data: null, isLoading: false }) }));
vi.mock('@/components/seo/PageSEO', () => ({ PageSEO: () => null }));
vi.mock('@/components/store/StoreLayout', () => ({ StoreLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/shopify/ShopifyProductGrid', () => ({ ShopifyProductGrid: ({ title, products, sidebar }: { title: string; products: ShopifyProduct[]; sidebar: ReactNode }) => <div><h1>{title}</h1>{sidebar}{products.map(p => <p key={p.node.id}>{p.node.title}</p>)}</div> }));
vi.mock('@/components/store/CategoryFilters', () => ({ CategoryFilters: ({ filters, onFiltersChange }: { filters: FilterState; onFiltersChange: (f: FilterState) => void }) => <button onClick={() => onFiltersChange({ ...filters, priceRange: [0, 100] })}>Até 100</button> }));

beforeEach(() => {
  vi.clearAllMocks();
  productsHook.mockReturnValue({ data: [{ node: {
    id: '1', title: 'Bota em oferta', tags: [],
    priceRange: { minVariantPrice: { amount: '150' }, maxVariantPrice: { amount: '150' } },
    compareAtPriceRange: { minVariantPrice: { amount: '300' } }, variants: { edges: [] },
  } }], isLoading: false, isError: false, refetch: retry });
});

function setup() {
  render(<MemoryRouter initialEntries={['/mais-vendidos']}><Link to="/promocoes">Abrir promoções</Link><Routes><Route path="*" element={<ProductListingPage />} /></Routes></MemoryRouter>);
}

describe('navegação para promoções', () => {
  it('reinicia filtros da rota anterior e exibe produtos com desconto', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Até 100' }));
    expect(screen.queryByText('Bota em oferta')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Abrir promoções' }));
    expect(screen.getByRole('heading', { name: 'Promoções' })).toBeInTheDocument();
    expect(screen.getByText('Bota em oferta')).toBeInTheDocument();
  });

  it('oferece nova tentativa quando o catálogo falha', () => {
    productsHook.mockReturnValue({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch: retry });
    setup();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os produtos');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
