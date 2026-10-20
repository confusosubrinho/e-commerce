import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RestockRequests from '@/pages/admin/RestockRequests';

const mocks = vi.hoisted(() => ({ update: vi.fn(), stock: vi.fn() }));
vi.mock('@/lib/shopify/client', () => ({ storefrontApiRequest: mocks.stock }));
vi.mock('@/hooks/useStoreContact', () => ({ formatPhone: (s: string) => s }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  let updating = false;
  const chain = {
    select: () => updating ? Promise.resolve({ data: [{ id: 'request-1' }], error: null }) : chain,
    order: () => chain, eq: () => chain, or: () => chain,
    update: (data: unknown) => { updating = true; mocks.update(data); return chain; },
    range: async () => ({ count: 1, error: null, data: [{ id: 'request-1', name: 'Cliente Teste', email: 'cliente@example.com', whatsapp: '5511999991234', product_title: 'Bota teste', product_handle: 'bota-teste', variant_id: 'variant-1', variant_title: 'Preto / 38', status: 'waiting', created_at: '2026-10-20T12:00:00Z', notified_at: null }] }),
  };
  return chain;
} } }));

beforeEach(() => { mocks.update.mockReset(); mocks.stock.mockResolvedValue({ data: { nodes: [{ id: 'variant-1', availableForSale: true }] } }); });

describe('fila manual de avisos', () => {
  it('prepara contato para a variante disponível e não persiste dados pessoais no cache local', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><RestockRequests /></QueryClientProvider>);
    await screen.findByText('Disponível para compra');
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsapp.getAttribute('href')).toContain('https://wa.me/5511999991234?text=');
    expect(decodeURIComponent(whatsapp.getAttribute('href') ?? '')).toContain('Preto / 38');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(client.getQueryCache().find({ queryKey: ['restock-requests', 'waiting', '', 0] })?.meta?.persist).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Já avisei' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'notified', notified_at: expect.any(String) })));
  });
});
