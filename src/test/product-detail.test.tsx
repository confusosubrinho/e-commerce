import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductDetail from '@/pages/ProductDetail';

const { productHook } = vi.hoisted(() => ({ productHook: vi.fn() }));
vi.mock('@/hooks/useShopifyProducts', () => ({
  useShopifyProduct: productHook,
  useShopifyProductRecommendations: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/usePricingConfig', () => ({ usePricingConfig: () => ({ data: null }) }));
vi.mock('@/components/store/StoreLayout', () => ({ StoreLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

function renderProduct(path = '/produto/bota-teste', route = '/produto/:handle') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={<ProductDetail />} /></Routes></MemoryRouter>);
}

beforeEach(() => {
  productHook.mockReset();
  productHook.mockReturnValue({ data: null, isLoading: false, isError: false });
});

describe('ProductDetail Shopify', () => {
  it('consulta a Shopify com o handle da rota', () => {
    renderProduct();
    expect(productHook).toHaveBeenCalledWith('bota-teste');
    expect(screen.getByRole('heading', { name: 'Produto não encontrado' })).toBeInTheDocument();
  });

  it('mostra skeleton durante a consulta', () => {
    productHook.mockReturnValue({ data: null, isLoading: true, isError: false });
    renderProduct();
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
    expect(screen.queryByText('Produto não encontrado')).not.toBeInTheDocument();
  });

  it('oferece retorno à loja quando a consulta falha', () => {
    productHook.mockReturnValue({ data: null, isLoading: false, isError: true });
    renderProduct('/produto/bota-teste', '/produto/:slug');
    expect(productHook).toHaveBeenCalledWith('bota-teste');
    expect(screen.getByRole('link', { name: 'Voltar para a loja' })).toHaveAttribute('href', '/');
  });
});
