/**
 * Configuração de checkout — força fluxo Yampi.
 *
 * Estratégia:
 * O app "Yampi Checkout" instalado no Shopify intercepta a página LEGADA
 * de carrinho (`/cart`) e substitui o botão "Finalizar Compra" pelo redirect
 * para o domínio seguro da Yampi. O novo checkout do Shopify
 * (`/checkouts/cn/...` retornado pela Storefront API) NÃO é interceptado.
 *
 * Portanto, ao finalizar a compra, montamos um cart permalink legado:
 *   https://{loja}.myshopify.com/cart/{numericVariantId}:{qty},{...}
 * Esse URL abre a página de carrinho legada do Shopify, onde o app Yampi
 * assume e redireciona o cliente para `seguro.vanessalimashoes.com.br`.
 *
 * Mantemos a URL base da Yampi como fallback final caso não haja itens.
 */
import { SHOPIFY_STORE_PERMANENT_DOMAIN } from '@/lib/shopify/client';

export const YAMPI_CHECKOUT_BASE_URL = 'https://seguro.vanessalimashoes.com.br/';

export interface CartLineForCheckout {
  variantId: string; // GID: gid://shopify/ProductVariant/12345
  quantity: number;
}

/** Extrai o ID numérico de um GID `gid://shopify/ProductVariant/12345`. */
function extractNumericVariantId(gid: string): string | null {
  const match = gid.match(/(\d+)(?:\?.*)?$/);
  return match ? match[1] : null;
}

/**
 * Monta o URL de cart permalink LEGADO do Shopify, que aciona o app Yampi.
 * Formato: https://loja.myshopify.com/cart/VARIANT_ID:QTY,VARIANT_ID:QTY
 */
export function buildShopifyLegacyCartUrl(lines: CartLineForCheckout[]): string | null {
  const segments = lines
    .map((l) => {
      const id = extractNumericVariantId(l.variantId);
      if (!id || l.quantity <= 0) return null;
      return `${id}:${l.quantity}`;
    })
    .filter((s): s is string => !!s);

  if (segments.length === 0) return null;

  return `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/cart/${segments.join(',')}`;
}

/**
 * Retorna a URL final para iniciar o checkout, priorizando o fluxo Yampi.
 * Se houver itens, gera o permalink legado do Shopify (Yampi app intercepta).
 * Caso contrário, redireciona direto para o domínio Yampi como fallback.
 *
 * O `shopifyCheckoutUrl` (novo checkout) é IGNORADO de propósito — ele
 * pula a página de carrinho legada e o app Yampi não consegue interceptar.
 */
export function resolveCheckoutUrl(
  _shopifyCheckoutUrl: string | null | undefined,
  lines: CartLineForCheckout[] = []
): string {
  const legacyCartUrl = buildShopifyLegacyCartUrl(lines);
  if (legacyCartUrl) return legacyCartUrl;
  return YAMPI_CHECKOUT_BASE_URL;
}
