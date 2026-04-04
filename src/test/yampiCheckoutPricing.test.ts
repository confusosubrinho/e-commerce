import { describe, expect, it } from "vitest";
import {
  computeCheckoutPricing,
  validateCouponAndComputeDiscount,
  validateCheckoutAmount,
  AMOUNT_TOLERANCE_BRL,
} from "../../supabase/functions/_shared/yampiCheckoutPricing.ts";
import type { CheckoutItem, CouponRow } from "../../supabase/functions/_shared/yampiCheckoutPricing.ts";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<CheckoutItem> = {}): CheckoutItem {
  return {
    variant_id: "var-1",
    quantity: 1,
    unit_price: 100,
    product_id: "prod-1",
    product_name: "Produto A",
    ...overrides,
  };
}

function makeCoupon(overrides: Partial<CouponRow> = {}): CouponRow {
  return {
    id: "coup-1",
    code: "DESCONTO10",
    type: "percentage",
    discount_type: "percentage",
    discount_value: 10,
    min_purchase_amount: null,
    applicable_product_ids: null,
    applicable_category_id: null,
    exclude_sale_products: null,
    max_uses: null,
    current_uses: 0,
    expiry_date: null,
    start_date: null,
    is_active: true,
    ...overrides,
  };
}

// ─── validateCouponAndComputeDiscount ────────────────────────────────────────

describe("validateCouponAndComputeDiscount", () => {
  it("retorna 0 quando não há cupom", () => {
    const r = validateCouponAndComputeDiscount(null, [makeItem()], 100);
    expect(r.discount_amount).toBe(0);
    expect(r.coupon_id).toBeNull();
    expect(r.rejection_reason).toBeNull();
  });

  it("aplica desconto percentual simples", () => {
    const coupon = makeCoupon({ discount_type: "percentage", discount_value: 10 });
    const r = validateCouponAndComputeDiscount(coupon, [makeItem({ unit_price: 200 })], 200);
    expect(r.discount_amount).toBe(20);
    expect(r.coupon_id).toBe("coup-1");
    expect(r.rejection_reason).toBeNull();
  });

  it("aplica desconto fixo", () => {
    const coupon = makeCoupon({ discount_type: "fixed", discount_value: 30 });
    const r = validateCouponAndComputeDiscount(coupon, [makeItem({ unit_price: 100 })], 100);
    expect(r.discount_amount).toBe(30);
  });

  it("não excede o subtotal aplicável", () => {
    const coupon = makeCoupon({ discount_type: "fixed", discount_value: 999 });
    const r = validateCouponAndComputeDiscount(coupon, [makeItem({ unit_price: 50 })], 50);
    expect(r.discount_amount).toBe(50);
  });

  it("rejeita cupom inativo", () => {
    const coupon = makeCoupon({ is_active: false });
    const r = validateCouponAndComputeDiscount(coupon, [makeItem()], 100);
    expect(r.discount_amount).toBe(0);
    expect(r.rejection_reason).toBe("coupon_inactive");
  });

  it("rejeita cupom expirado", () => {
    const coupon = makeCoupon({ expiry_date: "2020-01-01T00:00:00Z" });
    const r = validateCouponAndComputeDiscount(coupon, [makeItem()], 100);
    expect(r.discount_amount).toBe(0);
    expect(r.rejection_reason).toBe("coupon_expired");
  });

  it("rejeita cupom ainda não ativo (start_date futuro)", () => {
    const coupon = makeCoupon({ start_date: "2099-01-01T00:00:00Z" });
    const r = validateCouponAndComputeDiscount(coupon, [makeItem()], 100);
    expect(r.rejection_reason).toBe("coupon_not_yet_active");
  });

  it("rejeita quando limite de usos atingido", () => {
    const coupon = makeCoupon({ max_uses: 10, current_uses: 10 });
    const r = validateCouponAndComputeDiscount(coupon, [makeItem()], 100);
    expect(r.rejection_reason).toBe("coupon_max_uses_reached");
  });

  it("rejeita quando subtotal abaixo do mínimo", () => {
    const coupon = makeCoupon({ min_purchase_amount: 200 });
    const r = validateCouponAndComputeDiscount(coupon, [makeItem({ unit_price: 50 })], 50);
    expect(r.discount_amount).toBe(0);
    expect(r.rejection_reason).toContain("coupon_min_purchase_not_met");
  });

  it("aplica cupom apenas a produtos elegíveis (applicable_product_ids)", () => {
    const coupon = makeCoupon({
      discount_type: "percentage",
      discount_value: 50,
      applicable_product_ids: ["prod-1"],
    });
    const items = [
      makeItem({ product_id: "prod-1", unit_price: 100, quantity: 2 }), // 200 elegível
      makeItem({ variant_id: "var-2", product_id: "prod-2", unit_price: 100, quantity: 1 }), // 100 não elegível
    ];
    const r = validateCouponAndComputeDiscount(coupon, items, 300);
    expect(r.discount_amount).toBe(100); // 50% de 200
  });

  it("aplica cupom apenas a produtos da categoria (applicable_category_id)", () => {
    const coupon = makeCoupon({
      discount_type: "percentage",
      discount_value: 20,
      applicable_category_id: "cat-a",
    });
    const items = [
      makeItem({ product_id: "prod-1", unit_price: 100 }),
      makeItem({ variant_id: "var-2", product_id: "prod-2", unit_price: 200 }),
    ];
    const categoryMap = new Map([
      ["prod-1", "cat-a"],
      ["prod-2", "cat-b"],
    ]);
    const r = validateCouponAndComputeDiscount(coupon, items, 300, categoryMap);
    expect(r.discount_amount).toBe(20); // 20% de 100 (prod-1 cat-a)
  });

  it("rejeita quando nenhum item é elegível pela categoria", () => {
    const coupon = makeCoupon({ applicable_category_id: "cat-x" });
    const items = [makeItem({ product_id: "prod-1" })];
    const categoryMap = new Map([["prod-1", "cat-other"]]);
    const r = validateCouponAndComputeDiscount(coupon, items, 100, categoryMap);
    expect(r.rejection_reason).toBe("coupon_no_eligible_items");
  });

  it("frete grátis: discount_amount = 0, is_free_shipping = true, coupon_id preenchido", () => {
    const coupon = makeCoupon({ type: "free_shipping" });
    const r = validateCouponAndComputeDiscount(coupon, [makeItem()], 100);
    expect(r.discount_amount).toBe(0);
    expect(r.is_free_shipping).toBe(true);
    expect(r.coupon_id).toBe("coup-1");
    expect(r.rejection_reason).toBeNull();
  });

  it("cupom com desconto inválido (valor 0)", () => {
    const coupon = makeCoupon({ discount_type: "fixed", discount_value: 0 });
    const r = validateCouponAndComputeDiscount(coupon, [makeItem({ unit_price: 100 })], 100);
    expect(r.discount_amount).toBe(0);
  });
});

// ─── computeCheckoutPricing ─────────────────────────────────────────────────

describe("computeCheckoutPricing", () => {
  it("checkout simples sem cupom", () => {
    const items = [makeItem({ unit_price: 150, quantity: 2 })];
    const result = computeCheckoutPricing(items, null, 20);
    expect(result.subtotal).toBe(300);
    expect(result.discount_amount).toBe(0);
    expect(result.shipping_amount).toBe(20);
    expect(result.total_amount).toBe(320);
    expect(result.coupon_id).toBeNull();
  });

  it("checkout com cupom percentual válido", () => {
    const items = [makeItem({ unit_price: 200, quantity: 1 })];
    const coupon = makeCoupon({ discount_type: "percentage", discount_value: 10 });
    const result = computeCheckoutPricing(items, coupon, 15);
    expect(result.subtotal).toBe(200);
    expect(result.discount_amount).toBe(20);
    expect(result.total_amount).toBe(195); // 200 - 20 + 15
    expect(result.coupon_id).toBe("coup-1");
  });

  it("checkout com cupom de frete grátis: zera shipping", () => {
    const items = [makeItem({ unit_price: 100 })];
    const coupon = makeCoupon({ type: "free_shipping" });
    const result = computeCheckoutPricing(items, coupon, 30);
    expect(result.shipping_amount).toBe(0);
    expect(result.discount_amount).toBe(0);
    expect(result.total_amount).toBe(100);
    expect(result.is_free_shipping_coupon).toBe(true);
  });

  it("checkout com cupom inválido (expirado): desconto não aplicado", () => {
    const items = [makeItem({ unit_price: 100 })];
    const coupon = makeCoupon({ expiry_date: "2020-01-01T00:00:00Z" });
    const result = computeCheckoutPricing(items, coupon, 10);
    expect(result.discount_amount).toBe(0);
    expect(result.total_amount).toBe(110);
    expect(result.coupon_id).toBeNull();
  });

  it("total nunca é negativo", () => {
    const items = [makeItem({ unit_price: 10 })];
    const coupon = makeCoupon({ discount_type: "fixed", discount_value: 999 });
    const result = computeCheckoutPricing(items, coupon, 0);
    expect(result.total_amount).toBeGreaterThanOrEqual(0);
  });

  it("arredonda corretamente a 2 casas decimais", () => {
    const items = [makeItem({ unit_price: 33.333, quantity: 3 })];
    const result = computeCheckoutPricing(items, null, 0);
    expect(result.subtotal).toBe(100);  // 33.333 * 3 = 99.999 → arredonda para 100.00
  });
});

// ─── validateCheckoutAmount ──────────────────────────────────────────────────

describe("validateCheckoutAmount", () => {
  it("amounts iguais: consistent = true", () => {
    const r = validateCheckoutAmount(100, 100);
    expect(r.consistent).toBe(true);
    expect(r.difference_brl).toBe(0);
    expect(r.reason).toBeNull();
  });

  it("dentro da tolerância (R$0,30): consistent = true", () => {
    const r = validateCheckoutAmount(100, 100.30);
    expect(r.consistent).toBe(true);
  });

  it("na tolerância exata (R$0,50): consistent = true", () => {
    const r = validateCheckoutAmount(100, 100.50);
    expect(r.consistent).toBe(true);
  });

  it("acima da tolerância (R$0,51): consistent = false", () => {
    const r = validateCheckoutAmount(100, 100.51);
    expect(r.consistent).toBe(false);
    expect(r.reason).toContain("amount_mismatch");
    expect(r.difference_brl).toBeCloseTo(0.51, 2);
  });

  it("pagamento menor que esperado: também inconsistente", () => {
    const r = validateCheckoutAmount(200, 150);
    expect(r.consistent).toBe(false);
    expect(r.difference_brl).toBe(50);
  });

  it("tolerância customizada", () => {
    const r = validateCheckoutAmount(100, 102, 5);
    expect(r.consistent).toBe(true);
  });

  it("tolerância customizada (excedida)", () => {
    const r = validateCheckoutAmount(100, 106, 5);
    expect(r.consistent).toBe(false);
  });

  it("constante AMOUNT_TOLERANCE_BRL é R$0,50", () => {
    expect(AMOUNT_TOLERANCE_BRL).toBe(0.50);
  });

  it("inclui valores esperado e pago na mensagem de reason", () => {
    const r = validateCheckoutAmount(199.90, 299.90);
    expect(r.reason).toContain("expected=199.90");
    expect(r.reason).toContain("paid=299.90");
  });

  it("cenário: desconto não aplicado na Yampi (cupom aplicado localmente)", () => {
    // Cliente viu R$90 com cupom de 10% mas Yampi cobrou R$100 (sem cupom)
    const r = validateCheckoutAmount(90, 100);
    expect(r.consistent).toBe(false);
    expect(r.difference_brl).toBe(10);
  });
});
