import { SHOPIFY_STORE_PERMANENT_DOMAIN } from '@/lib/shopify/client';
import { shopifyNumericId, trackCommerce } from '@/lib/tracking';

export const YAMPI_CHECKOUT_BASE_URL = 'https://seguro.vanessalimashoes.com.br/';
const YAMPI_PUBLIC_CART_ENDPOINT = 'https://api.dooki.com.br/v2/public/shopify/cart';
export const CHECKOUT_UNAVAILABLE_MESSAGE = 'Não foi possível abrir o checkout da Yampi. Seu carrinho foi mantido. Tente novamente.';

export interface CartLineForCheckout {
  variantId: string; // GID: gid://shopify/ProductVariant/12345
  productId?: string;
  quantity: number;
  title?: string;
  variantTitle?: string;
  price?: string;
  sku?: string;
  requiresShipping?: boolean;
}

/** Extrai o ID numérico de um GID `gid://shopify/ProductVariant/12345`. */
function extractNumericVariantId(gid: string): string | null {
  const match = gid.match(/(\d+)(?:\?.*)?$/);
  return match ? match[1] : null;
}

interface YampiCartPayloadItem {
  id: number;
  variant_id: number;
  quantity: number;
  title: string;
  variant_title: string;
  price: number;
  final_price: number;
  line_price: number;
  final_line_price: number;
  sku: string;
  vendor: string;
  product_id: number;
  requires_shipping: boolean;
  grams: number;
}

interface YampiCartPayload {
  token: string;
  note: null;
  attributes: Record<string, string>;
  original_total_price: number;
  total_price: number;
  total_discount: number;
  total_weight: number;
  item_count: number;
  items: YampiCartPayloadItem[];
  requires_shipping: boolean;
  currency: string;
  items_subtotal_price: number;
  cart_level_discount_applications: Array<Record<string, unknown>>;
  discount_codes: Array<Record<string, unknown>>;
}

interface YampiCartResponse {
  active: boolean;
  checkout_direct_url?: string;
  url?: string;
}

function amountToCents(amount?: string): number {
  const parsed = Number.parseFloat(amount ?? '0');
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

function createHeadlessCartToken(lines: CartLineForCheckout[]): string {
  const payload = lines
    .map((line) => `${line.variantId}:${line.quantity}`)
    .sort()
    .join('|');

  const encoded = typeof btoa === 'function'
    ? btoa(payload).replace(/=+$/g, '')
    : payload.replace(/[^a-zA-Z0-9]/g, '');

  return `headless-${encoded.slice(0, 48) || Date.now()}`;
}

function buildYampiCartPayload(lines: CartLineForCheckout[]): YampiCartPayload | null {
  const items = lines
    .map((line): YampiCartPayloadItem | null => {
      const numericId = extractNumericVariantId(line.variantId);
      if (!numericId || line.quantity <= 0) return null;

      const priceInCents = amountToCents(line.price);
      const quantity = Math.max(1, Math.trunc(line.quantity));

      return {
        id: Number(numericId),
        variant_id: Number(numericId),
        quantity,
        title: line.title ?? 'Produto',
        variant_title: line.variantTitle ?? 'Padrão',
        price: priceInCents,
        final_price: priceInCents,
        line_price: priceInCents * quantity,
        final_line_price: priceInCents * quantity,
        sku: line.sku ?? '',
        vendor: 'Vanessa Lima Shoes',
        product_id: Number(extractNumericVariantId(line.productId ?? '') ?? 0),
        requires_shipping: line.requiresShipping ?? true,
        grams: 0,
      };
    })
    .filter((item): item is YampiCartPayloadItem => item !== null);

  if (items.length === 0) return null;

  const subtotal = items.reduce((sum, item) => sum + item.final_line_price, 0);

  return {
    token: createHeadlessCartToken(lines),
    note: null,
    attributes: {},
    original_total_price: subtotal,
    total_price: subtotal,
    total_discount: 0,
    total_weight: 0,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    items,
    requires_shipping: items.some((item) => item.requires_shipping),
    currency: 'BRL',
    items_subtotal_price: subtotal,
    cart_level_discount_applications: [],
    discount_codes: [],
  };
}

async function resolveYampiCheckoutUrl(lines: CartLineForCheckout[]): Promise<string | null> {
  const cartPayload = buildYampiCartPayload(lines);
  if (!cartPayload) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(YAMPI_PUBLIC_CART_ENDPOINT, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        shop: window.location.hostname,
        shopify_internal_domain: SHOPIFY_STORE_PERMANENT_DOMAIN,
        cart_payload: cartPayload,
      }),
    });

    if (!response.ok) {
      throw new Error(`Yampi checkout HTTP ${response.status}`);
    }

    const data = (await response.json()) as YampiCartResponse;
    for (const candidate of [data.checkout_direct_url, data.url]) {
      if (!candidate) continue;
      try {
        const url = new URL(candidate);
        if (url.origin === new URL(YAMPI_CHECKOUT_BASE_URL).origin && url.pathname.startsWith('/checkout')) {
          return url.href;
        }
      } catch {
        // Uma URL inválida não autoriza trocar o checkout pela Shopify.
      }
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function startCheckout(lines: CartLineForCheckout[]): Promise<string> {
  if (lines.length === 0) throw new Error(CHECKOUT_UNAVAILABLE_MESSAGE);
  try {
    trackCommerce('begin_checkout', lines.map((l) => ({
      id: shopifyNumericId(l.productId ?? l.variantId),
      name: l.title ?? 'Produto',
      price: Number.parseFloat(l.price ?? '0') || 0,
      quantity: l.quantity,
    })));
  } catch (error) {
    console.warn('[checkout] Falha no rastreamento:', error);
  }

  try {
    const yampiUrl = await resolveYampiCheckoutUrl(lines);
    if (yampiUrl) return yampiUrl;
  } catch (error) {
    console.warn('[checkout] Falha ao criar carrinho Yampi:', error);
  }
  throw new Error(CHECKOUT_UNAVAILABLE_MESSAGE);
}
