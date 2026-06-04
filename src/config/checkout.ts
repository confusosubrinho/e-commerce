/**
 * Configuração de checkout — prioriza Yampi.
 * O app Yampi Checkout instalado no Shopify intercepta /checkout e redireciona
 * para o domínio seguro. Mantemos uma URL base de fallback caso a interceptação
 * não esteja ativa por algum motivo.
 */
export const YAMPI_CHECKOUT_BASE_URL = 'https://seguro.vanessalimashoes.com.br/';

/**
 * Retorna a URL final do checkout, priorizando a Yampi.
 * Se o Shopify retornou um checkoutUrl (que o app Yampi intercepta), usamos.
 * Caso contrário, redirecionamos diretamente para o domínio seguro da Yampi.
 */
export function resolveCheckoutUrl(shopifyCheckoutUrl: string | null | undefined): string {
  if (shopifyCheckoutUrl && shopifyCheckoutUrl.length > 0) return shopifyCheckoutUrl;
  return YAMPI_CHECKOUT_BASE_URL;
}
