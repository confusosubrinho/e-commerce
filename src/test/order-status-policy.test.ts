import { describe, expect, it } from 'vitest';
import { canTransitionStatus, resolveSafeStatus } from '../../supabase/functions/_shared/orderStatus';

describe('shared order status transition policy', () => {
  it('permite progressão esperada', () => {
    expect(canTransitionStatus('pending', 'processing')).toBe(true);
    expect(canTransitionStatus('processing', 'shipped')).toBe(true);
    expect(canTransitionStatus('shipped', 'delivered')).toBe(true);
  });

  it('evita regressão inválida', () => {
    expect(canTransitionStatus('delivered', 'processing')).toBe(false);
    expect(resolveSafeStatus('delivered', 'processing')).toBe('delivered');
  });

  it('mantém compatibilidade quando status desconhecido', () => {
    expect(resolveSafeStatus('legacy_custom_status', 'delivered')).toBe('delivered');
    expect(resolveSafeStatus('processing', 'legacy_custom_status')).toBe('processing');
  });
});
