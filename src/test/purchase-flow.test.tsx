import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useShopifyCartStore } from '@/stores/shopifyCartStore';
import Cart from '@/pages/Cart';
import CheckoutStart from '@/pages/CheckoutStart';

vi.mock('@/components/store/StoreLayout', () => ({ StoreLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/seo/PageSEO', () => ({ PageSEO: () => null }));

function renderCart(entry = '/carrinho') {
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/carrinho" element={<Cart />} /><Route path="/checkout/start" element={<CheckoutStart />} /></Routes></MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  useShopifyCartStore.setState({ items: [], cartId: null, checkoutUrl: null, isLoading: false, isSyncing: false });
});

describe('Carrinho Shopify', () => {
  it('permite voltar à loja quando o carrinho está vazio', () => {
    renderCart();
    expect(screen.getByText('Seu carrinho está vazio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continuar comprando/i })).toHaveAttribute('href', '/');
  });

  it('exibe os itens do store Shopify e o total pela quantidade', () => {
    useShopifyCartStore.setState({ items: [{
      lineId: 'line-1', variantId: 'gid://shopify/ProductVariant/123', variantTitle: '38',
      product: { id: 'gid://shopify/Product/1', title: 'Bota Teste', handle: 'bota-teste' },
      price: { amount: '100.00', currencyCode: 'BRL' }, quantity: 2,
      selectedOptions: [{ name: 'Tamanho', value: '38' }],
    }] });
    renderCart();
    expect(screen.getByRole('link', { name: 'Bota Teste' })).toHaveAttribute('href', '/produto/bota-teste');
    expect(screen.getAllByText(/200,00/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: /finalizar compra/i })).toBeEnabled();
    expect(screen.getByText('Frete e cupons são calculados no checkout seguro.')).toBeInTheDocument();
  });

  it('não permite finalizar durante sincronização do carrinho', () => {
    useShopifyCartStore.setState({ isSyncing: true, items: [{
      lineId: 'line-1', variantId: 'variant-1', variantTitle: '38',
      product: { id: 'product-1', title: 'Bota Teste', handle: 'bota-teste' },
      price: { amount: '100', currencyCode: 'BRL' }, quantity: 1, selectedOptions: [],
    }] });
    renderCart();
    const buttons = screen.getAllByRole('button');
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });

  it('a entrada antiga de checkout retorna ao carrinho', async () => {
    renderCart('/checkout/start');
    expect(await screen.findByText('Seu carrinho está vazio')).toBeInTheDocument();
  });
});
