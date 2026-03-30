export type QuoteSnapshot = {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  currency: string;
  items_count?: number;
};

export type ReconciliationResult = {
  ok: boolean;
  tolerance: number;
  delta_total: number;
  expected: QuoteSnapshot;
  gateway_total: number;
  reason: string | null;
};

export function compareAmounts(expected: number, observed: number, tolerance = 0.5): { ok: boolean; delta: number; tolerance: number } {
  const delta = Number((observed - expected).toFixed(2));
  return { ok: Math.abs(delta) <= tolerance, delta, tolerance };
}

export function reconcileQuoteWithGateway(params: {
  expected: QuoteSnapshot;
  gateway_total: number;
  tolerance?: number;
}): ReconciliationResult {
  const tolerance = params.tolerance ?? 0.5;
  const amountCheck = compareAmounts(params.expected.total, Number(params.gateway_total || 0), tolerance);

  if (!amountCheck.ok) {
    return {
      ok: false,
      tolerance,
      delta_total: amountCheck.delta,
      expected: params.expected,
      gateway_total: Number(params.gateway_total || 0),
      reason: "TOTAL_MISMATCH",
    };
  }

  return {
    ok: true,
    tolerance,
    delta_total: amountCheck.delta,
    expected: params.expected,
    gateway_total: Number(params.gateway_total || 0),
    reason: null,
  };
}
