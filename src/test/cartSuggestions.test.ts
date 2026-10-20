import { describe, expect, it } from 'vitest';
import { freeShippingProgress, rankCartSuggestions } from '@/lib/cartSuggestions';
import type { ShopifyProductNode } from '@/lib/shopify/types';

const product = (id: string, price: number, available = true): ShopifyProductNode => ({
  id, handle: id, title: id, description: '', availableForSale: available, images: { edges: [] }, options: [],
  priceRange: { minVariantPrice: { amount: String(price), currencyCode: 'BRL' }, maxVariantPrice: { amount: String(price), currencyCode: 'BRL' } },
  variants: { edges: [{ node: { id: `${id}-variant`, title: '38', availableForSale: available, price: { amount: String(price), currencyCode: 'BRL' }, selectedOptions: [] } }] },
});

describe('meta de frete grátis e compre junto', () => {
  it('calcula quanto falta em centavos e considera o limite exato', () => {
    expect(freeShippingProgress(164.5, 299)?.remaining).toBe(134.5);
    expect(freeShippingProgress(298.99, 299)?.remaining).toBe(0.01);
    expect(freeShippingProgress(299, 299)).toMatchObject({ reached: true, remaining: 0, percent: 100 });
    expect(freeShippingProgress(350, 299)?.percent).toBe(100);
  });
  it('não inventa benefício quando não há meta configurada', () => {
    expect(freeShippingProgress(100, 0)).toBeNull();
    expect(freeShippingProgress(100, null)).toBeNull();
  });
  it('prioriza os itens que completam a meta com menor excedente', () => {
    const result = rankCartSuggestions([product('barato', 50), product('alto', 200), product('perfeito', 140), product('quase', 130)], [], 134.5);
    expect(result.map((p) => p.product.id)).toEqual(['perfeito', 'alto', 'quase']);
  });
  it('exclui produtos já presentes e variantes esgotadas', () => {
    const sale = product('vendavel', 100);
    sale.variants.edges.unshift({ node: { ...sale.variants.edges[0].node, id: 'soldout', availableForSale: false, price: { amount: '1', currencyCode: 'BRL' } } });
    const result = rankCartSuggestions([product('nocarrinho', 135), product('esgotado', 150, false), sale], ['nocarrinho'], 134.5);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(100);
  });
});
