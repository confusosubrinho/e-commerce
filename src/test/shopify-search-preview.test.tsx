import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SearchPreview } from '@/components/store/SearchPreview';

const searchHook = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useShopifyProducts', () => ({ useShopifyProducts: searchHook }));
const edges = [{ node: {
  id: 'gid://shopify/Product/1', title: 'Bota Shopify', handle: 'bota-shopify',
  priceRange: { minVariantPrice: { amount: '100' } }, images: { edges: [] },
} }];
afterEach(() => vi.useRealTimers());

async function openSearch() {
  vi.useFakeTimers();
  searchHook.mockReturnValue({ data: edges, isLoading: false, isFetched: true });
  render(<MemoryRouter><SearchPreview onSearch={vi.fn()} /></MemoryRouter>);
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'bota' } });
  await act(async () => { vi.advanceTimersByTime(400); });
  return input;
}

describe('busca rápida Shopify', () => {
  it('consulta a Shopify e navega usando o handle', async () => {
    await openSearch();
    expect(searchHook).toHaveBeenLastCalledWith({ first: 6, query: 'bota', sortKey: 'RELEVANCE', enabled: true });
    expect(screen.getByRole('option')).toHaveAttribute('href', '/produto/bota-shopify');
    expect(screen.getByText('Bota Shopify')).toBeInTheDocument();
  });
  it('mantém a opção selecionada ao navegar com teclado', async () => {
    const input = await openSearch();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
