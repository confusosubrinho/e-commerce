import { describe, expect, it } from 'vitest';
import { calculateCheckoutQuote } from '../../supabase/functions/_shared/checkoutQuote';

describe('checkout quote server-side', () => {
  it('recalcula total sem cupom', () => {
    const quote = calculateCheckoutQuote({
      subtotal: 200,
      shippingCost: 20,
      lineItems: [],
    });

    expect(quote.discountAmount).toBe(0);
    expect(quote.totalAmount).toBe(220);
    expect(quote.couponValid).toBe(true);
  });

  it('aplica cupom válido no servidor', () => {
    const quote = calculateCheckoutQuote({
      subtotal: 200,
      shippingCost: 10,
      couponCode: 'OFF10',
      couponRow: {
        is_active: true,
        discount_type: 'percentage',
        discount_value: 10,
      },
      lineItems: [{ product_id: 'p1', category_id: null, brand: null, line_total: 200 }],
    });

    expect(quote.couponValid).toBe(true);
    expect(quote.discountAmount).toBe(20);
    expect(quote.totalAmount).toBe(190);
  });

  it('bloqueia cupom inválido e mantém total sem desconto', () => {
    const quote = calculateCheckoutQuote({
      subtotal: 200,
      shippingCost: 0,
      couponCode: 'OFF10',
      couponRow: {
        is_active: false,
        discount_type: 'percentage',
        discount_value: 10,
      },
      lineItems: [{ product_id: 'p1', category_id: null, brand: null, line_total: 200 }],
    });

    expect(quote.couponValid).toBe(false);
    expect(quote.discountAmount).toBe(0);
    expect(quote.totalAmount).toBe(200);
  });
});
