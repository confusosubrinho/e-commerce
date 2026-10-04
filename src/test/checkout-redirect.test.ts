import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { startCheckout, resolveCheckoutUrl, buildShopifyLegacyCartUrl, YAMPI_CHECKOUT_BASE_URL } from '@/config/checkout';
import { SHOPIFY_STORE_PERMANENT_DOMAIN } from '@/lib/shopify/client';

const lines = [{ variantId: 'gid://shopify/ProductVariant/12345', quantity: 2, title: 'Bota', variantTitle: '38', price: '100.50' }];
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
    expect(body.cart_payload.items[0]).toMatchObject({ variant_id: 12345, quantity: 2, price: 10050, final_line_price: 20100 });
    expect(body.cart_payload.total_price).toBe(20100);
  });
  it('aceita também a URL alternativa retornada pelo checkout', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ active: true, url: 'https://seguro.vanessalimashoes.com.br/checkout/alternativo' }), { status: 200 }));
    expect(await startCheckout(lines)).toContain('/checkout/alternativo');
  });
  it('mantém o permalink Shopify quando a API externa falha', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await startCheckout(lines)).toBe(`https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/cart/12345:2`);
  });
  it('mantém o fallback quando a API responde erro HTTP', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    expect(await startCheckout(lines)).toBe(buildShopifyLegacyCartUrl(lines));
  });
  it('ignora o checkout nativo Shopify para manter a integração externa', () => {
    expect(resolveCheckoutUrl('https://checkout.shopify.com/nativo', lines)).toBe(buildShopifyLegacyCartUrl(lines));
  });
  it('não chama a API com carrinho vazio e retorna o domínio seguro', async () => {
    expect(await startCheckout([])).toBe(YAMPI_CHECKOUT_BASE_URL);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
