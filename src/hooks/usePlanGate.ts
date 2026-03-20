import { useTenantPlan } from '@/hooks/useTenantPlan';
import type { PlanFeature } from '@/types/billing';

/**
 * Gate por feature do plano do tenant atual.
 * Uso: const { allowed, isLoading } = usePlanGate('reports_advanced');
 * Útil para esconder/desabilitar UI ou redirecionar para upgrade.
 */
export function usePlanGate(feature: PlanFeature) {
  const { canUse, isLoading, planSlug, billingStatus } = useTenantPlan();
  const allowed = canUse(feature);

  return {
    allowed,
    isLoading,
    planSlug,
    billingStatus,
  };
}
