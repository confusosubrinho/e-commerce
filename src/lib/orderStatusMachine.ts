export type CommercialOrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed'
  | 'refunded'
  | 'disputed';

const TRANSITIONS: Record<CommercialOrderStatus, CommercialOrderStatus[]> = {
  pending: ['processing', 'cancelled', 'failed'],
  processing: ['shipped', 'delivered', 'cancelled', 'refunded', 'disputed'],
  shipped: ['delivered', 'refunded', 'disputed'],
  delivered: ['refunded', 'disputed'],
  cancelled: [],
  failed: [],
  refunded: [],
  disputed: ['refunded'],
};

export function canTransitionOrderStatus(from: CommercialOrderStatus, to: CommercialOrderStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function resolveOrderStatusTransition(
  current: CommercialOrderStatus,
  next: CommercialOrderStatus,
): CommercialOrderStatus {
  if (canTransitionOrderStatus(current, next)) return next;
  return current;
}
