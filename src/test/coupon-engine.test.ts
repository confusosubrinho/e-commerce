import { describe, it, expect } from 'vitest';
import { validateCouponAgainstContext } from '../../supabase/functions/_shared/coupon-engine';

const baseContext = {
  subtotal: 200,
  shipping_cost: 20,
  shipping_state: 'SP',
  shipping_city: 'São Paulo',
  shipping_zip: '01310-100',
  line_items: [
    { product_id: 'p1', category_id: 'c1', brand: 'BrandA', line_total: 120, is_promotional: false },
    { product_id: 'p2', category_id: 'c2', brand: 'BrandB', line_total: 80, is_promotional: true },
  ],
};

describe('coupon engine', () => {
  it('valida mínimo de subtotal', () => {
    const result = validateCouponAgainstContext({ discount_type: 'fixed', discount_value: 10, min_purchase_amount: 250, is_active: true }, baseContext);
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('COUPON_MIN_SUBTOTAL');
  });

  it('valida máximo de subtotal', () => {
    const result = validateCouponAgainstContext({ discount_type: 'fixed', discount_value: 10, max_purchase_amount: 150, is_active: true }, baseContext);
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('COUPON_MAX_SUBTOTAL');
  });

  it('valida região por estado/cidade/cep', () => {
    const result = validateCouponAgainstContext({ discount_type: 'fixed', discount_value: 10, applicable_states: ['RJ'], is_active: true }, baseContext);
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('COUPON_REGION_NOT_ELIGIBLE');
  });

  it('valida elegibilidade por produto/categoria', () => {
    const result = validateCouponAgainstContext({ discount_type: 'fixed', discount_value: 10, applicable_product_ids: ['px'], is_active: true }, baseContext);
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('COUPON_PRODUCT_NOT_ELIGIBLE');
  });

  it('valida expirado e pausado', () => {
    const expired = validateCouponAgainstContext({ discount_type: 'fixed', discount_value: 10, is_active: true, end_at: '2020-01-01T00:00:00.000Z' }, baseContext);
    expect(expired.error_code).toBe('COUPON_EXPIRED');

    const paused = validateCouponAgainstContext({ discount_type: 'fixed', discount_value: 10, is_active: true, status: 'paused' }, baseContext);
    expect(paused.error_code).toBe('COUPON_PAUSED');
  });

  it('valida sem saldo de uso e não cumulativo', () => {
    const exhausted = validateCouponAgainstContext({ discount_type: 'fixed', discount_value: 10, is_active: true, max_uses: 3, uses_count: 3 }, baseContext);
    expect(exhausted.error_code).toBe('COUPON_USAGE_LIMIT_REACHED');

    const notStackable = validateCouponAgainstContext({ discount_type: 'fixed', discount_value: 10, is_active: true, allow_auto_promotions: false }, { ...baseContext, has_automatic_discount: true });
    expect(notStackable.error_code).toBe('COUPON_NOT_COMBINABLE');
  });

  it('calcula desconto percentual e frete grátis de forma segura', () => {
    const pct = validateCouponAgainstContext({ discount_type: 'percentage', discount_value: 10, is_active: true }, baseContext);
    expect(pct.ok).toBe(true);
    expect(pct.discount_amount).toBe(20);

    const shipping = validateCouponAgainstContext({ discount_kind: 'free_shipping', discount_type: 'fixed', discount_value: 0, is_active: true }, baseContext);
    expect(shipping.ok).toBe(true);
    expect(shipping.discount_amount).toBe(20);
  });
});
