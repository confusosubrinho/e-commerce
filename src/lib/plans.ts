/**
 * Constantes e helpers para planos de tenant (billing SaaS).
 * Alinhado com tenant_plans e usePlanGate.
 */

import type { PlanFeature, PlanSlug } from '@/types/billing';

export const PLAN_SLUGS = ['free', 'starter', 'pro', 'enterprise'] as const;

/** Ordem de “força” do plano para comparação. */
const PLAN_ORDER: Record<PlanSlug, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

/** Features incluídas em cada plano (slug). */
const FEATURES_BY_PLAN: Record<PlanSlug, PlanFeature[]> = {
  free: [],
  starter: ['checkout_stripe', 'reports_basic'],
  pro: ['checkout_stripe', 'reports_advanced', 'custom_domain', 'support_priority'],
  enterprise: [
    'checkout_stripe',
    'reports_advanced',
    'custom_domain',
    'support_priority',
    'api_access',
    'white_label',
  ],
};

/**
 * Verifica se um plano (por slug) inclui a feature.
 * Se planSlug for null/undefined, trata como free.
 */
export function canUseFeature(
  planSlug: PlanSlug | string | null | undefined,
  feature: PlanFeature
): boolean {
  const slug = (planSlug as PlanSlug) ?? 'free';
  const features = FEATURES_BY_PLAN[slug] ?? FEATURES_BY_PLAN.free;
  return features.includes(feature);
}

/**
 * Retorna true se o plano A tem pelo menos a mesma “força” que o plano B.
 */
export function planHasAtLeast(planSlug: PlanSlug | string | null | undefined, minimum: PlanSlug): boolean {
  const slug = (planSlug as PlanSlug) ?? 'free';
  const a = PLAN_ORDER[slug] ?? 0;
  const b = PLAN_ORDER[minimum] ?? 0;
  return a >= b;
}

/**
 * Limite numérico do plano (-1 = ilimitado).
 */
export function getPlanLimit(
  planSlug: PlanSlug | string | null | undefined,
  limitKey: 'max_products' | 'max_orders_per_month'
): number {
  const defaults: Record<string, number> = {
    max_products: 10,
    max_orders_per_month: 50,
  };
  const slug = (planSlug as PlanSlug) ?? 'free';
  const limitsByPlan: Record<PlanSlug, Record<string, number>> = {
    free: { max_products: 10, max_orders_per_month: 50 },
    starter: { max_products: 100, max_orders_per_month: 500 },
    pro: { max_products: 1000, max_orders_per_month: 5000 },
    enterprise: { max_products: -1, max_orders_per_month: -1 },
  };
  const limits = limitsByPlan[slug] ?? limitsByPlan.free;
  return limits[limitKey] ?? defaults[limitKey] ?? -1;
}
