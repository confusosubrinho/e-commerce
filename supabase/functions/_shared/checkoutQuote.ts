import { validateCouponAgainstContext, type CouponLineItem } from "./coupon-engine.ts";

export type CheckoutQuoteInput = {
  subtotal: number;
  shippingCost: number;
  couponCode?: string | null;
  couponRow?: Record<string, unknown> | null;
  lineItems: CouponLineItem[];
  shippingState?: string | null;
  shippingCity?: string | null;
  shippingZip?: string | null;
};

export type CheckoutQuoteResult = {
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  couponCode: string | null;
  couponValid: boolean;
  errorCode: string | null;
  errorMessage: string | null;
};

export function calculateCheckoutQuote(input: CheckoutQuoteInput): CheckoutQuoteResult {
  const subtotal = Math.max(0, Number(input.subtotal || 0));
  const shippingCost = Math.max(0, Number(input.shippingCost || 0));

  if (!input.couponCode) {
    return {
      subtotal,
      shippingCost,
      discountAmount: 0,
      totalAmount: Math.max(0, subtotal + shippingCost),
      couponCode: null,
      couponValid: true,
      errorCode: null,
      errorMessage: null,
    };
  }

  const validation = validateCouponAgainstContext(input.couponRow || null, {
    subtotal,
    shipping_cost: shippingCost,
    shipping_state: input.shippingState || null,
    shipping_city: input.shippingCity || null,
    shipping_zip: input.shippingZip || null,
    line_items: input.lineItems,
  });

  if (!validation.ok) {
    return {
      subtotal,
      shippingCost,
      discountAmount: 0,
      totalAmount: Math.max(0, subtotal + shippingCost),
      couponCode: input.couponCode,
      couponValid: false,
      errorCode: validation.error_code,
      errorMessage: validation.error_message,
    };
  }

  const discountAmount = Math.max(0, Number(validation.discount_amount || 0));
  return {
    subtotal,
    shippingCost,
    discountAmount,
    totalAmount: Math.max(0, subtotal - discountAmount + shippingCost),
    couponCode: input.couponCode,
    couponValid: true,
    errorCode: null,
    errorMessage: null,
  };
}
