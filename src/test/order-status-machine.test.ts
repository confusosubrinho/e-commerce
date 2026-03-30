import { describe, expect, it } from 'vitest';
import { canTransitionOrderStatus, resolveOrderStatusTransition } from '@/lib/orderStatusMachine';

describe('order status machine', () => {
  it('permite transições válidas', () => {
    expect(canTransitionOrderStatus('pending', 'processing')).toBe(true);
    expect(canTransitionOrderStatus('processing', 'shipped')).toBe(true);
    expect(canTransitionOrderStatus('shipped', 'delivered')).toBe(true);
  });

  it('bloqueia regressões inválidas', () => {
    expect(canTransitionOrderStatus('delivered', 'processing')).toBe(false);
    expect(canTransitionOrderStatus('cancelled', 'processing')).toBe(false);
    expect(canTransitionOrderStatus('refunded', 'delivered')).toBe(false);
  });

  it('resolve sem quebrar compatibilidade', () => {
    expect(resolveOrderStatusTransition('processing', 'shipped')).toBe('shipped');
    expect(resolveOrderStatusTransition('delivered', 'processing')).toBe('delivered');
  });
});
