export type AbandonedCartCandidate = {
  id: string;
  created_at: string;
  recovered?: boolean | null;
  status?: string | null;
  operational_status?: string | null;
};

export function shouldReuseAbandonedCart(candidate: AbandonedCartCandidate | null, now: Date = new Date(), windowMinutes = 1440): boolean {
  if (!candidate) return false;
  if (candidate.recovered === true) return false;
  if (candidate.status === 'recovered') return false;
  if (candidate.operational_status === 'converted') return false;
  if (candidate.operational_status === 'expired') return false;

  const createdAt = new Date(candidate.created_at);
  if (Number.isNaN(createdAt.getTime())) return false;

  const ageMs = now.getTime() - createdAt.getTime();
  return ageMs >= 0 && ageMs <= windowMinutes * 60 * 1000;
}

export type RecoveryEvent = {
  at: string;
  type: 'checkout_activity' | 'manual_contact' | 'manual_recovery' | 'converted';
  channel?: string | null;
  order_id?: string | null;
  note?: string | null;
};

export type CartLifecycleStatus = "active" | "abandoned" | "expired" | "converted";

export type LifecycleTransition = {
  operational_status: CartLifecycleStatus;
  abandoned_at?: string | null;
  expired_at?: string | null;
  converted_at?: string | null;
};

export function appendRecoveryEvent(
  current: unknown,
  event: RecoveryEvent,
  maxItems = 50,
): RecoveryEvent[] {
  const base = Array.isArray(current) ? current.filter((x) => typeof x === 'object' && x !== null) : [];
  const next = [...base, event] as RecoveryEvent[];
  return next.slice(Math.max(0, next.length - maxItems));
}

export function resolveLifecycleTransition(params: {
  current: CartLifecycleStatus | null | undefined;
  target: CartLifecycleStatus;
  nowIso?: string;
}): LifecycleTransition | null {
  const nowIso = params.nowIso ?? new Date().toISOString();
  const current = params.current ?? "active";
  const target = params.target;

  if (current === "converted" && target !== "converted") return null;
  if (current === "expired" && target === "abandoned") return null;
  if (current === target) return { operational_status: target };

  if (target === "abandoned") {
    if (current !== "active") return null;
    return { operational_status: "abandoned", abandoned_at: nowIso };
  }
  if (target === "expired") {
    if (current !== "active" && current !== "abandoned") return null;
    return { operational_status: "expired", expired_at: nowIso };
  }
  if (target === "converted") {
    return { operational_status: "converted", converted_at: nowIso };
  }
  return { operational_status: "active" };
}
