import { describe, it, expect } from 'vitest';
import type { CartItem, Coupon } from '@/types/database';
import {
  computeCouponDiscount,
  getApplicableSubtotal,
  hasEligibleItems,
  isCouponValidForLocation,
  validateCouponDates,
} from '@/lib/couponDiscount';

function makeItem(overrides: Partial<{ productId: string; categoryId: string; unitPrice: number; salePrice: number | null; basePrice: number; quantity: number }>): CartItem {
  const { productId = 'p1', categoryId = 'cat1', unitPrice = 100, salePrice = null, basePrice = 100, quantity = 1 } = overrides;
  return {
    product: { id: productId, name: 'Test', slug: 'test', description: null, base_price: basePrice, sale_price: salePrice, cost: null, sku: null, category_id: categoryId, is_active: true, is_featured: false, is_new: false, created_at: '', updated_at: '' },
    variant: { id: 'v1', product_id: productId, size: 'M', color: null, color_hex: null, stock_quantity: 10, price_modifier: 0, base_price: basePrice, sale_price: salePrice, sku: null, is_active: true, created_at: '' },
    quantity,
  } as CartItem;
}

function makeCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'c1', code: 'TEST10', discount_type: 'percentage', discount_value: 10,
    min_purchase_amount: 0, max_uses: null, uses_count: 0, expiry_date: null,
    start_date: null, is_active: true, created_at: '', updated_at: '',
    ...overrides,
  };
}

describe('couponDiscount', () => {
  describe('computeCouponDiscount', () => {
    it('percentage discount', () => {
      expect(computeCouponDiscount(makeCoupon({ discount_value: 10 }), [makeItem({})], 100)).toBe(10);
    });
    it('fixed discount', () => {
      expect(computeCouponDiscount(makeCoupon({ discount_type: 'fixed', discount_value: 15 }), [makeItem({})], 100)).toBe(15);
    });
    it('caps at subtotal', () => {
      expect(computeCouponDiscount(makeCoupon({ discount_type: 'fixed', discount_value: 200 }), [makeItem({})], 100)).toBe(100);
    });
    it('returns 0 for free_shipping type', () => {
      expect(computeCouponDiscount(makeCoupon({ type: 'free_shipping' }), [makeItem({})], 100)).toBe(0);
    });
    it('returns 0 if min_purchase not met', () => {
      expect(computeCouponDiscount(makeCoupon({ min_purchase_amount: 200 }), [makeItem({})], 100)).toBe(0);
    });
    it('excludes sale items when exclude_sale_products is true', () => {
      const saleItem = makeItem({ salePrice: 80, basePrice: 100 });
      expect(computeCouponDiscount(makeCoupon({ exclude_sale_products: true }), [saleItem], 80)).toBe(0);
    });
    it('applies to non-sale items when exclude_sale_products is true', () => {
      const normalItem = makeItem({ basePrice: 100, salePrice: null });
      expect(computeCouponDiscount(makeCoupon({ exclude_sale_products: true, discount_value: 10 }), [normalItem], 100)).toBe(10);
    });
    it('returns 0 for null coupon', () => {
      expect(computeCouponDiscount(null, [makeItem({})], 100)).toBe(0);
    });
    it('rounds to 2 decimals', () => {
      const result = computeCouponDiscount(makeCoupon({ discount_value: 33.33 }), [makeItem({})], 100);
      expect(result).toBe(33.33);
    });
  });

  describe('hasEligibleItems', () => {
    it('returns true when no restrictions', () => {
      expect(hasEligibleItems(makeCoupon(), [makeItem({})])).toBe(true);
    });
    it('returns false when product restriction doesnt match', () => {
      expect(hasEligibleItems(makeCoupon({ applicable_product_ids: ['other'] }), [makeItem({})])).toBe(false);
    });
    it('returns true when product restriction matches', () => {
      expect(hasEligibleItems(makeCoupon({ applicable_product_ids: ['p1'] }), [makeItem({})])).toBe(true);
    });
    it('returns false for sale items with exclude_sale_products', () => {
      const saleItem = makeItem({ salePrice: 80, basePrice: 100 });
      expect(hasEligibleItems(makeCoupon({ exclude_sale_products: true }), [saleItem])).toBe(false);
    });
  });

  describe('validateCouponDates', () => {
    it('returns null for valid coupon', () => {
      expect(validateCouponDates(makeCoupon())).toBeNull();
    });
    it('returns error for future start_date', () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      expect(validateCouponDates(makeCoupon({ start_date: future }))).toContain('ainda não está disponível');
    });
    it('returns error for expired coupon', () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      expect(validateCouponDates(makeCoupon({ expiry_date: past }))).toContain('expirou');
    });
  });

  describe('isCouponValidForLocation', () => {
    it('returns true with no restrictions', () => {
      expect(isCouponValidForLocation(makeCoupon(), 'SP', '01310100')).toBe(true);
    });
    it('returns false for wrong state', () => {
      expect(isCouponValidForLocation(makeCoupon({ applicable_states: ['RJ'] }), 'SP', '01310100')).toBe(false);
    });
    it('returns true for matching state', () => {
      expect(isCouponValidForLocation(makeCoupon({ applicable_states: ['SP'] }), 'SP', '01310100')).toBe(true);
    });
    it('returns false for wrong zip', () => {
      expect(isCouponValidForLocation(makeCoupon({ applicable_zip_prefixes: ['20000'] }), 'SP', '01310100')).toBe(false);
    });
    it('returns true for matching zip prefix', () => {
      expect(isCouponValidForLocation(makeCoupon({ applicable_zip_prefixes: ['01310'] }), 'SP', '01310100')).toBe(true);
    });
  });
});
