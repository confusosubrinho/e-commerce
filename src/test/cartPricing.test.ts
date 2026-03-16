/**
 * Testes unitários para src/lib/cartPricing.ts
 */
import { describe, it, expect } from 'vitest';
import { getCartItemUnitPrice, getCartItemTotalPrice, hasSaleDiscount } from '@/lib/cartPricing';
import type { CartItem, Product, ProductVariant } from '@/types/database';

function mockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Produto',
    slug: 'produto',
    description: null,
    base_price: 100,
    sale_price: null,
    cost: null,
    sku: null,
    category_id: null,
    is_active: true,
    is_featured: false,
    is_new: false,
    created_at: '',
    updated_at: '',
    weight: null,
    width: null,
    height: null,
    depth: null,
    gtin: null,
    mpn: null,
    brand: null,
    condition: null,
    google_product_category: null,
    age_group: null,
    gender: null,
    material: null,
    pattern: null,
    seo_title: null,
    seo_description: null,
    seo_keywords: null,
    ...overrides,
  };
}

function mockVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 'v1',
    product_id: 'p1',
    size: 'M',
    color: null,
    color_hex: null,
    stock_quantity: 10,
    price_modifier: 0,
    base_price: null,
    sale_price: null,
    sku: null,
    is_active: true,
    created_at: '',
    ...overrides,
  };
}

function mockCartItem(item: { product?: Partial<Product>; variant?: Partial<ProductVariant>; quantity?: number }): CartItem {
  return {
    product: mockProduct(item.product),
    variant: mockVariant(item.variant),
    quantity: item.quantity ?? 1,
  };
}

describe('cartPricing', () => {
  describe('getCartItemUnitPrice', () => {
    it('usa variant.sale_price quando definido e > 0', () => {
      const item = mockCartItem({ variant: { sale_price: 80, base_price: 100 } });
      expect(getCartItemUnitPrice(item)).toBe(80);
    });

    it('usa variant.base_price quando variant.sale_price não definido', () => {
      const item = mockCartItem({ variant: { base_price: 90 } });
      expect(getCartItemUnitPrice(item)).toBe(90);
    });

    it('usa preço do produto + price_modifier quando variant não tem preço próprio', () => {
      const item = mockCartItem({
        product: { base_price: 100, sale_price: null },
        variant: { base_price: null, sale_price: null, price_modifier: 10 },
      });
      expect(getCartItemUnitPrice(item)).toBe(110);
    });

    it('usa product.sale_price antes de base_price quando variant sem preço', () => {
      const item = mockCartItem({
        product: { base_price: 100, sale_price: 85 },
        variant: { base_price: null, sale_price: null },
      });
      expect(getCartItemUnitPrice(item)).toBe(85);
    });
  });

  describe('getCartItemTotalPrice', () => {
    it('multiplica preço unitário pela quantidade', () => {
      const item = mockCartItem({ variant: { base_price: 50 }, quantity: 3 });
      expect(getCartItemTotalPrice(item)).toBe(150);
    });
  });

  describe('hasSaleDiscount', () => {
    it('retorna true quando variant tem sale_price < base_price', () => {
      const item = mockCartItem({ variant: { sale_price: 70, base_price: 100 } });
      expect(hasSaleDiscount(item)).toBe(true);
    });

    it('retorna true quando product tem sale_price < base_price', () => {
      const item = mockCartItem({ product: { sale_price: 90, base_price: 100 } });
      expect(hasSaleDiscount(item)).toBe(true);
    });

    it('retorna false quando não há desconto em variant nem product', () => {
      const item = mockCartItem({
        product: { base_price: 100, sale_price: null },
        variant: { base_price: 100, sale_price: null },
      });
      expect(hasSaleDiscount(item)).toBe(false);
    });
  });
});
