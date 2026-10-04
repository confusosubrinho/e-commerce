import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShopifyProductCard } from '@/components/shopify/ShopifyProductCard';
import { useShopifyFavoritesStore } from '@/stores/shopifyFavoritesStore';
import type { ShopifyProduct } from '@/lib/shopify/types';

const addItem = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/hooks/usePricingConfig', () => ({ usePricingConfig: () => ({ data: null }) }));
vi.mock('@/stores/shopifyCartStore', () => ({
  useShopifyCartStore: (selector: (state: unknown) => unknown) => selector({ addItem, isLoading: false }),
}));
const product: ShopifyProduct = { node: {
  id: 'gid://shopify/Product/1', title: 'Bota Shopify', handle: 'bota-shopify', description: '',
  availableForSale: true,
  priceRange: { minVariantPrice: { amount: '100', currencyCode: 'BRL' }, maxVariantPrice: { amount: '100', currencyCode: 'BRL' } },
  images: { edges: [] }, options: [],
  variants: { edges: [{ node: { id: 'gid://shopify/ProductVariant/2', title: '38', availableForSale: true, price: { amount: '100', currencyCode: 'BRL' }, selectedOptions: [{ name: 'Tamanho', value: '38' }] } }] },
} };

beforeEach(() => { useShopifyFavoritesStore.setState({ handles: [] }); addItem.mockClear(); });
describe('catálogo e favoritos Shopify', () => {
  it('adiciona e remove favoritos por handle sem catálogo local', () => {
    render(<MemoryRouter><ShopifyProductCard product={product} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Favoritar' }));
    expect(useShopifyFavoritesStore.getState().handles).toEqual(['bota-shopify']);
    expect(screen.getByRole('button', { name: 'Remover dos favoritos' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Remover dos favoritos' }));
    expect(useShopifyFavoritesStore.getState().handles).toEqual([]);
  });
  it('mostra indisponibilidade recebida da Shopify', () => {
    render(<MemoryRouter><ShopifyProductCard product={{ node: { ...product.node, availableForSale: false } }} /></MemoryRouter>);
    expect(screen.getByText('Sem estoque')).toBeInTheDocument();
    expect(addItem).not.toHaveBeenCalled();
  });
});
