import { describe, expect, it } from 'vitest';
import { reconcileQuoteWithGateway } from '../../supabase/functions/_shared/financialReconciliation';

describe('financial reconciliation', () => {
  it('aprova quando total bate na tolerância', () => {
    const result = reconcileQuoteWithGateway({
      expected: { subtotal: 200, discount: 20, shipping: 10, total: 190, currency: 'BRL' },
      gateway_total: 190.3,
      tolerance: 0.5,
    });
    expect(result.ok).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('reprova quando total diverge fora da tolerância', () => {
    const result = reconcileQuoteWithGateway({
      expected: { subtotal: 200, discount: 20, shipping: 10, total: 190, currency: 'BRL' },
      gateway_total: 196,
      tolerance: 0.5,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('TOTAL_MISMATCH');
  });
});
