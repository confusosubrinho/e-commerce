/** Rotas antigas aposentadas. Não há opção de reativar a operação local.
 * A operação comercial é gerenciada pela Shopify. */
export const ADMIN_SHOPIFY_HIDDEN_URLS: readonly string[] = [
  // Catálogo local (Shopify é dona)
  '/admin/produtos',
  '/admin/categorias',
  '/admin/avaliacoes',
  // Pedidos / clientes / carrinhos (Shopify)
  '/admin/pedidos',
  '/admin/carrinhos-abandonados',
  '/admin/clientes',
  // Analytics de vendas (Shopify Analytics)
  '/admin/vendas',
  '/admin/trafego',
  '/admin/registro-manual',
  // Marketing transacional (cupons/automacoes ficam na Shopify)
  '/admin/cupons',
  '/admin/email-automations',
  // Pagamento / checkout / integrações de venda
  '/admin/checkout-transparente',
  '/admin/precos',
  '/admin/integracoes',
  '/admin/commerce-health',
  '/admin/sistema',
  '/admin/configuracoes/conversoes',
];

/** Bloqueia as rotas locais aposentadas e preserva as restrições de acesso existentes. */
export function isAdminUrlHidden(url?: string): boolean {
  if (!url) return false;
  return ADMIN_SHOPIFY_HIDDEN_URLS.some(
    (hidden) => url === hidden || url.startsWith(`${hidden}/`)
  );
}
