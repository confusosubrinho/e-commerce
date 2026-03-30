import { describe, expect, it } from 'vitest';
import { appendRecoveryEvent, shouldReuseAbandonedCart } from '../../supabase/functions/_shared/abandonedCart';

describe('abandoned cart dedup window', () => {
  it('reusa carrinho recente não recuperado', () => {
    const now = new Date('2026-03-30T12:00:00.000Z');
    const candidate = {
      id: '1',
      created_at: '2026-03-30T11:40:00.000Z',
      recovered: false,
      status: 'pending',
      operational_status: 'active',
    };
    expect(shouldReuseAbandonedCart(candidate, now, 60)).toBe(true);
  });

  it('não reusa carrinho recuperado', () => {
    const now = new Date('2026-03-30T12:00:00.000Z');
    const candidate = {
      id: '1',
      created_at: '2026-03-30T11:40:00.000Z',
      recovered: true,
      status: 'recovered',
      operational_status: 'converted',
    };
    expect(shouldReuseAbandonedCart(candidate, now, 60)).toBe(false);
  });

  it('não reusa carrinho convertido ou expirado', () => {
    const now = new Date('2026-03-30T12:00:00.000Z');
    expect(
      shouldReuseAbandonedCart({
        id: '1',
        created_at: '2026-03-30T11:50:00.000Z',
        recovered: false,
        status: 'pending',
        operational_status: 'converted',
      }, now, 60),
    ).toBe(false);

    expect(
      shouldReuseAbandonedCart({
        id: '2',
        created_at: '2026-03-30T11:50:00.000Z',
        recovered: false,
        status: 'pending',
        operational_status: 'expired',
      }, now, 60),
    ).toBe(false);
  });

  it('não reusa carrinho fora da janela', () => {
    const now = new Date('2026-03-30T12:00:00.000Z');
    const candidate = {
      id: '1',
      created_at: '2026-03-28T11:40:00.000Z',
      recovered: false,
      status: 'pending',
      operational_status: 'active',
    };
    expect(shouldReuseAbandonedCart(candidate, now, 60)).toBe(false);
  });
});

describe('abandoned cart recovery events', () => {
  it('adiciona evento preservando histórico e limite', () => {
    const base = [{ at: '2026-03-30T10:00:00.000Z', type: 'checkout_activity' as const }];
    const result = appendRecoveryEvent(base, {
      at: '2026-03-30T11:00:00.000Z',
      type: 'converted',
      channel: 'yampi_webhook',
      order_id: 'order-1',
    });

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ type: 'converted', order_id: 'order-1' });
  });
});
