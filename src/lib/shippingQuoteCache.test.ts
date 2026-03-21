import { describe, it, expect, vi } from 'vitest';
import type { ShippingOption } from '@/types/database';
import {
  buildShippingQuoteKey,
  getCachedShippingQuote,
  setCachedShippingQuote,
} from './shippingQuoteCache';

describe('shippingQuoteCache', () => {
  it('buildShippingQuoteKey é estável para mesmos itens em ordem diferente', () => {
    const itemsA = [
      { variant: { id: 'b' }, quantity: 2 },
      { variant: { id: 'a' }, quantity: 1 },
    ];
    const itemsB = [
      { variant: { id: 'a' }, quantity: 1 },
      { variant: { id: 'b' }, quantity: 2 },
    ];
    expect(buildShippingQuoteKey('01310100', itemsA)).toBe(buildShippingQuoteKey('01310100', itemsB));
  });

  it('get retorna null após TTL com tempo simulado', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T12:00:00.000Z'));
    const opt: ShippingOption[] = [{ id: 'x', name: 'PAC', price: 10, deadline: '5d', company: 'C' }];
    const key = buildShippingQuoteKey('04567890', [{ variant: { id: 'cepa' }, quantity: 1 }]);
    setCachedShippingQuote(key, opt, 399);
    expect(getCachedShippingQuote(key)?.options).toEqual(opt);
    vi.advanceTimersByTime(91_000);
    expect(getCachedShippingQuote(key)).toBeNull();
    vi.useRealTimers();
  });
});
