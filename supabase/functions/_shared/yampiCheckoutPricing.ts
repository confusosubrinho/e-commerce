/**
 * yampiCheckoutPricing.ts
 *
 * Funções puras de cálculo de preço e validação de cupom para o checkout Yampi.
 * Toda lógica de negócio crítica fica aqui — testável sem dependência do runtime Deno.
 *
 * REGRA FUNDAMENTAL: o backend é a única fonte de verdade do preço final.
 * O frontend nunca deve ter autoridade sobre valores que serão cobrados.
 */

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface CheckoutItem {
  variant_id: string;
  quantity: number;
  unit_price: number;   // preço unitário calculado pelo backend (do DB)
  product_id: string | null;
  product_name: string;
}

export interface CouponRow {
  id: string;
  code: string;
  type: string;                        // 'percentage' | 'fixed' | 'free_shipping'
  discount_type: string;               // 'percentage' | 'fixed'
  discount_value: number;
  min_purchase_amount: number | null;
  applicable_product_ids: string[] | null;
  applicable_category_id: string | null;
  exclude_sale_products: boolean | null;
  max_uses: number | null;
  current_uses: number | null;
  expiry_date: string | null;
  start_date: string | null;
  is_active: boolean;
}

export interface CouponValidationResult {
  /** Desconto aplicável em reais (0 se cupom inválido ou de frete grátis) */
  discount_amount: number;
  /** ID do cupom validado (null se não aplicado) */
  coupon_id: string | null;
  /** Cupom é de frete grátis */
  is_free_shipping: boolean;
  /** Motivo de rejeição (null se aplicado com sucesso) */
  rejection_reason: string | null;
}

export interface CheckoutPricingResult {
  subtotal: number;
  discount_amount: number;
  coupon_id: string | null;
  is_free_shipping_coupon: boolean;
  shipping_amount: number;
  total_amount: number;
}

// ─── Tolerância para divergência de amount ──────────────────────────────────

/** Diferença máxima tolerada em reais entre amount esperado e pago (R$0,50). */
export const AMOUNT_TOLERANCE_BRL = 0.50;

// ─── Validação de cupom (pura) ───────────────────────────────────────────────

/**
 * Valida um cupom e computa o desconto a ser aplicado.
 *
 * Parâmetros:
 * @param coupon       Linha do cupom vinda do banco (null = sem cupom)
 * @param items        Itens do carrinho com preços calculados pelo backend
 * @param subtotal     Subtotal total do carrinho (soma de todos os itens)
 * @param categoryMap  Mapa product_id → category_id (para restrição por categoria)
 * @param now          Timestamp de referência (injetável para testes)
 */
export function validateCouponAndComputeDiscount(
  coupon: CouponRow | null,
  items: CheckoutItem[],
  subtotal: number,
  categoryMap: Map<string, string | null> = new Map(),
  now: Date = new Date(),
): CouponValidationResult {
  if (!coupon) {
    return { discount_amount: 0, coupon_id: null, is_free_shipping: false, rejection_reason: null };
  }

  if (!coupon.is_active) {
    return { discount_amount: 0, coupon_id: null, is_free_shipping: false, rejection_reason: "coupon_inactive" };
  }

  // Frete grátis: sem desconto no subtotal
  if (coupon.type === "free_shipping") {
    return { discount_amount: 0, coupon_id: coupon.id, is_free_shipping: true, rejection_reason: null };
  }

  // Validade
  if (coupon.start_date && new Date(coupon.start_date) > now) {
    return { discount_amount: 0, coupon_id: null, is_free_shipping: false, rejection_reason: "coupon_not_yet_active" };
  }
  if (coupon.expiry_date && new Date(coupon.expiry_date) < now) {
    return { discount_amount: 0, coupon_id: null, is_free_shipping: false, rejection_reason: "coupon_expired" };
  }

  // Limite de usos
  if (coupon.max_uses != null && (coupon.current_uses ?? 0) >= coupon.max_uses) {
    return { discount_amount: 0, coupon_id: null, is_free_shipping: false, rejection_reason: "coupon_max_uses_reached" };
  }

  // Valor mínimo de compra
  const minPurchase = coupon.min_purchase_amount ?? 0;
  if (minPurchase > 0 && subtotal < minPurchase) {
    return {
      discount_amount: 0,
      coupon_id: null,
      is_free_shipping: false,
      rejection_reason: `coupon_min_purchase_not_met:required=${minPurchase},subtotal=${subtotal}`,
    };
  }

  // Subtotal aplicável (filtrado por produto ou categoria)
  let applicableSubtotal = subtotal;

  const productIds = (coupon.applicable_product_ids ?? []).filter(Boolean);
  if (productIds.length > 0) {
    const eligibleSet = new Set(productIds);
    applicableSubtotal = items.reduce(
      (sum, i) => (i.product_id && eligibleSet.has(i.product_id) ? sum + i.unit_price * i.quantity : sum),
      0,
    );
  } else if (coupon.applicable_category_id) {
    applicableSubtotal = items.reduce((sum, i) => {
      const catId = i.product_id ? (categoryMap.get(i.product_id) ?? null) : null;
      return catId === coupon.applicable_category_id ? sum + i.unit_price * i.quantity : sum;
    }, 0);
  }

  if (applicableSubtotal <= 0) {
    return {
      discount_amount: 0,
      coupon_id: null,
      is_free_shipping: false,
      rejection_reason: "coupon_no_eligible_items",
    };
  }

  // Calcula o desconto bruto
  const raw =
    coupon.discount_type === "percentage"
      ? (applicableSubtotal * Number(coupon.discount_value)) / 100
      : Number(coupon.discount_value);

  // Arredonda e limita ao máximo do subtotal aplicável
  const discountAmount = Math.round(Math.min(applicableSubtotal, Math.max(0, raw)) * 100) / 100;

  return {
    discount_amount: discountAmount,
    coupon_id: coupon.id,
    is_free_shipping: false,
    rejection_reason: null,
  };
}

// ─── Cálculo do total congelado ──────────────────────────────────────────────

/**
 * Computa o resultado final de pricing para um checkout.
 * Todos os valores são calculados a partir do DB — o frontend só exibe.
 */
export function computeCheckoutPricing(
  items: CheckoutItem[],
  coupon: CouponRow | null,
  shippingAmount: number,
  categoryMap: Map<string, string | null> = new Map(),
  now: Date = new Date(),
): CheckoutPricingResult {
  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  // Arredonda subtotal a 2 casas
  const subtotalRounded = Math.round(subtotal * 100) / 100;

  const couponResult = validateCouponAndComputeDiscount(coupon, items, subtotalRounded, categoryMap, now);

  const shippingFinal = couponResult.is_free_shipping ? 0 : Math.max(0, shippingAmount);

  const totalAmount = Math.max(
    0,
    Math.round((subtotalRounded - couponResult.discount_amount + shippingFinal) * 100) / 100,
  );

  return {
    subtotal: subtotalRounded,
    discount_amount: couponResult.discount_amount,
    coupon_id: couponResult.coupon_id,
    is_free_shipping_coupon: couponResult.is_free_shipping,
    shipping_amount: shippingFinal,
    total_amount: totalAmount,
  };
}

// ─── Validação de amount pago ────────────────────────────────────────────────

export interface AmountValidationResult {
  /** true = consistente (dentro da tolerância) */
  consistent: boolean;
  /** Diferença em reais entre pago e esperado */
  difference_brl: number;
  /** Mensagem descritiva para auditoria */
  reason: string | null;
}

/**
 * Valida se o amount recebido do gateway está dentro da tolerância do valor esperado.
 *
 * @param expectedTotal  Total calculado e congelado na checkout_session (backend)
 * @param paidTotal      Total informado pelo gateway/webhook
 * @param toleranceBrl   Tolerância em reais (padrão: AMOUNT_TOLERANCE_BRL)
 */
export function validateCheckoutAmount(
  expectedTotal: number,
  paidTotal: number,
  toleranceBrl: number = AMOUNT_TOLERANCE_BRL,
): AmountValidationResult {
  const diff = Math.abs(paidTotal - expectedTotal);

  if (diff <= toleranceBrl) {
    return { consistent: true, difference_brl: diff, reason: null };
  }

  return {
    consistent: false,
    difference_brl: diff,
    reason:
      `amount_mismatch:expected=${expectedTotal.toFixed(2)},paid=${paidTotal.toFixed(2)},diff=${diff.toFixed(2)}`,
  };
}
