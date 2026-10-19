import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { startCheckout, CHECKOUT_UNAVAILABLE_MESSAGE } from '@/config/checkout';
import { SHOPIFY_STORE_PERMANENT_DOMAIN } from '@/lib/shopify/client';

const lines = [{ variantId: 'gid://shopify/ProductVariant/12345', productId: 'gid://shopify/Product/98765', quantity: 2, title: 'Bota', variantTitle: '38', price: '100.50' }];
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('redirecionamento preservado do carrinho', () => {
  it('envia variantes Shopify e quantidades para obter o checkout externo', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ active: true, checkout_direct_url: 'https://seguro.vanessalimashoes.com.br/checkout/teste' }), { status: 200 }));
    expect(await startCheckout(lines)).toBe('https://seguro.vanessalimashoes.com.br/checkout/teste');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.dooki.com.br/v2/public/shopify/cart');
    const body = JSON.parse(options.body);
    expect(body.shopify_internal_domain).toBe(SHOPIFY_STORE_PERMANENT_DOMAIN);
    expect(body.cart_payload.items[0]).toMatchObject({ product_id: 98765, variant_id: 12345, quantity: 2, price: 10050, final_line_price: 20100 });
    expect(body.cart_payload.total_price).toBe(20100);
  });
  it('aceita também a URL alternativa retornada pelo checkout', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ active: true, url: 'https://seguro.vanessalimashoes.com.br/checkout/alternativo' }), { status: 200 }));
    expect(await startCheckout(lines)).toContain('/checkout/alternativo');
  });
  it('usa a URL Yampi quando a resposta traz active false mas inclui o checkout', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ active: false, checkout_direct_url: 'https://seguro.vanessalimashoes.com.br/checkout?product_option_id[0]=777&quantity[0]=2' }), { status: 200 }));
    const url = new URL(await startCheckout(lines));
    expect(url.hostname).toBe('seguro.vanessalimashoes.com.br');
    expect(url.searchParams.get('product_option_id[0]')).toBe('777');
    expect(url.searchParams.get('quantity[0]')).toBe('2');
  });
  it('não desvia para Shopify quando a API externa falha', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(startCheckout(lines)).rejects.toThrow(CHECKOUT_UNAVAILABLE_MESSAGE);
  });
  it('não desvia para Shopify quando a API responde erro HTTP', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    await expect(startCheckout(lines)).rejects.toThrow(CHECKOUT_UNAVAILABLE_MESSAGE);
  });
  it('não desvia para Shopify quando a Yampi não retorna URL', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ active: false, url: null, checkout_direct_url: '' }), { status: 200 }));
    await expect(startCheckout(lines)).rejects.toThrow(CHECKOUT_UNAVAILABLE_MESSAGE);
  });
  it.each(['https://checkout.shopify.com/nativo', 'https://vanessalima-o6a1s.myshopify.com/cart/12345:2', 'javascript:alert(1)'])('recusa destino diferente do checkout Yampi: %s', async (url) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ checkout_direct_url: url }), { status: 200 }));
    await expect(startCheckout(lines)).rejects.toThrow(CHECKOUT_UNAVAILABLE_MESSAGE);
  });
  it('não chama a API nem abre checkout vazio', async () => {
    await expect(startCheckout([])).rejects.toThrow(CHECKOUT_UNAVAILABLE_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
