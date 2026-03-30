export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed'
  | 'refunded'
  | 'disputed';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['processing', 'paid', 'cancelled', 'failed'],
  processing: ['paid', 'shipped', 'delivered', 'cancelled', 'refunded', 'disputed'],
  paid: ['processing', 'shipped', 'delivered', 'refunded', 'disputed'],
  shipped: ['delivered', 'refunded', 'disputed'],
  delivered: ['refunded', 'disputed'],
  cancelled: [],
  failed: [],
  refunded: [],
  disputed: ['refunded'],
};

export function normalizeOrderStatus(status: string | null | undefined): OrderStatus | null {
  const s = String(status || '').toLowerCase();
  if (!s) return null;
  if (s in TRANSITIONS) return s as OrderStatus;
  return null;
}

export function canTransitionStatus(from: string | null | undefined, to: string | null | undefined): boolean {
  const a = normalizeOrderStatus(from);
  const b = normalizeOrderStatus(to);
  if (!a || !b) return false;
  if (a === b) return true;
  return TRANSITIONS[a].includes(b);
}

export function resolveSafeStatus(current: string | null | undefined, requested: string | null | undefined): string {
  const cur = normalizeOrderStatus(current);
  const req = normalizeOrderStatus(requested);
  if (!req) return String(current || 'pending');
  if (!cur) return req;
  return canTransitionStatus(cur, req) ? req : cur;
}
