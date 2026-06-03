/**
 * Modo "Shopify gerencia a venda": quando true, o painel admin esconde
 * telas de catálogo, pedidos, checkout e integrações de pagamento — a
 * Shopify passa a ser a única fonte da verdade para esses dados.
 *
 * O admin local fica focado em:
 *  - Aparência (tema, banners, home builder, announcement bar)
 *  - Conteúdo institucional & SEO (páginas, FAQ, redes sociais)
 *  - Vitrines curadas que apontam para coleções/produtos da Shopify
 *
 * Para reativar tudo, basta colocar `false` aqui — as telas continuam
 * presentes no código, só estão ocultas no menu.
 */
export const ADMIN_SHOPIFY_MODE = true;

/**
 * URLs (prefixos) que ficam ocultas quando ADMIN_SHOPIFY_MODE é true.
 * Comparação é por prefixo: '/admin/pedidos' esconde também
 * '/admin/pedidos/123'.
 */
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
  '/admin/configuracoes/conversoes',
];

/** Retorna true se a URL está oculta no modo Shopify. */
export function isAdminUrlHidden(url?: string): boolean {
  if (!ADMIN_SHOPIFY_MODE || !url) return false;
  return ADMIN_SHOPIFY_HIDDEN_URLS.some(
    (hidden) => url === hidden || url.startsWith(`${hidden}/`)
  );
}
