import type { ShippingOption } from '@/types/database';

const TTL_MS = 90_000;
const MAX_KEYS = 32;

type Cached = { options: ShippingOption[]; freeShippingThreshold: number; at: number };

const store = new Map<string, Cached>();

export function buildShippingQuoteKey(
  cleanCep: string,
  items: Array<{ variant: { id: string }; quantity: number }>
): string {
  const part = items.map((i) => `${i.variant.id}:${i.quantity}`).sort().join('|');
  return `${cleanCep}:${part}`;
}

export function getCachedShippingQuote(key: string): Cached | null {
  const c = store.get(key);
  if (!c) return null;
  if (Date.now() - c.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return c;
}

export function setCachedShippingQuote(
  key: string,
  options: ShippingOption[],
  freeShippingThreshold: number
): void {
  if (store.size >= MAX_KEYS) {
    const first = store.keys().next().value;
    if (first !== undefined) store.delete(first);
  }
  store.set(key, { options, freeShippingThreshold, at: Date.now() });
}
