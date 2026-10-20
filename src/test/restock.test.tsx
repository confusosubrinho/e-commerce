import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RestockRequestDialog } from '@/components/store/RestockRequestDialog';
import { normalizeWhatsApp, restockContactSchema } from '@/lib/restock';
import type { ShopifyProductNode, ShopifyVariant } from '@/lib/shopify/types';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
const variant: ShopifyVariant = { id: 'gid://shopify/ProductVariant/10', title: 'Preto / 38', availableForSale: false, selectedOptions: [], price: { amount: '100', currencyCode: 'BRL' } };
const product: ShopifyProductNode = { id: 'gid://shopify/Product/1', handle: 'bota', title: 'Bota teste', availableForSale: false, description: '', options: [], images: { edges: [] }, variants: { edges: [{ node: variant }] }, priceRange: { minVariantPrice: variant.price, maxVariantPrice: variant.price } };

beforeEach(() => {
  rpc.mockReset(); rpc.mockResolvedValue({ error: null });
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
});
afterEach(() => vi.unstubAllGlobals());
function openForm() {
  render(<MemoryRouter><RestockRequestDialog product={product} variant={variant} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Avise-me quando chegar' }));
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Cliente Teste' } });
  fireEvent.change(screen.getByLabelText('WhatsApp com DDD'), { target: { value: '(11) 99999-1234' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'cliente@example.com' } });
}

describe('aviso manual de reposição', () => {
  it('normaliza DDD e rejeita contato ou consentimento inválidos', () => {
    expect(normalizeWhatsApp('(11) 99999-1234')).toBe('5511999991234');
    expect(normalizeWhatsApp('+55 11 99999-1234')).toBe('5511999991234');
    expect(restockContactSchema.safeParse({ name: 'Ana', email: 'ana@example.com', whatsapp: '123', consent: true }).success).toBe(false);
  });
  it('não envia os contatos sem autorização', () => {
    openForm();
    fireEvent.click(screen.getByRole('button', { name: 'Quero receber o aviso' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Autorize o contato');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('registra a variante exata e só confirma após o banco aceitar', async () => {
    openForm();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Quero receber o aviso' }));
    await screen.findByText('Pedido de aviso registrado');
    expect(rpc).toHaveBeenCalledWith('submit_restock_request', { p_data: expect.objectContaining({ name: 'Cliente Teste', whatsapp: '5511999991234', email: 'cliente@example.com', consent: true, variant_id: variant.id, product_id: product.id }) });
  });
  it('mantém o formulário disponível para tentar novamente se o banco falhar', async () => {
    rpc.mockResolvedValue({ error: { message: 'offline' } });
    openForm();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Quero receber o aviso' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar'));
    expect(screen.queryByText('Pedido de aviso registrado')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('cliente@example.com');
  });
});
