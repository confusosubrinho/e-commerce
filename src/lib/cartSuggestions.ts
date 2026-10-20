import type { ShopifyProductNode, ShopifyVariant } from '@/lib/shopify/types';

export function freeShippingProgress(subtotal: number, threshold: number | null | undefined) {
  if (!threshold || !Number.isFinite(threshold) || threshold <= 0) return null;
  const target = Math.round(threshold * 100);
  if (target <= 0) return null;
  const current = Number.isFinite(subtotal) ? Math.max(0, Math.round(subtotal * 100)) : 0;
  return { remaining: Math.max(0, target - current) / 100, percent: Math.min(100, current / target * 100), reached: current >= target };
}

export function rankCartSuggestions(products: ShopifyProductNode[], cartProductIds: string[], remaining: number) {
  const inCart = new Set(cartProductIds);
  return products.filter((p) => !inCart.has(p.id) && p.availableForSale).map((product) => {
    const available = product.variants.edges.map((e) => e.node).filter((v) => v.availableForSale && v.price.currencyCode === 'BRL');
    const cheapest = available.reduce<ShopifyVariant | undefined>((best, v) => !best || Number(v.price.amount) < Number(best.price.amount) ? v : best, undefined);
    return { product, price: cheapest ? Number(cheapest.price.amount) : NaN };
  }).filter((p) => Number.isFinite(p.price) && p.price > 0).sort((a, b) => {
    // Prefere completar a meta em um item com o menor excedente possível.
    const aCompletes = a.price >= remaining;
    const bCompletes = b.price >= remaining;
    if (aCompletes !== bCompletes) return aCompletes ? -1 : 1;
    return aCompletes ? a.price - b.price : b.price - a.price;
  }).slice(0, 3);
}
