import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { canUseFeature } from '@/lib/plans';
import type { TenantWithBilling, PlanFeature, PlanSlug } from '@/types/billing';

/**
 * Dados do tenant atual com plano e billing (para admin / feature gates).
 * Usa o tenantId resolvido por useTenant() e busca tenants + tenant_plans.
 */
export function useTenantPlan() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  const {
    data: tenant,
    isLoading: planLoading,
    error,
  } = useQuery({
    queryKey: ['tenant-plan', tenantId],
    queryFn: async (): Promise<TenantWithBilling | null> => {
      const { data, error: err } = await (supabase as any)
        .from('tenants')
        .select(
          `
          id,
          name,
          slug,
          domain,
          active,
          plan_id,
          billing_status,
          stripe_customer_id,
          stripe_subscription_id,
          trial_ends_at,
          plan_expires_at,
          tenant_plans (
            id,
            name,
            slug,
            stripe_price_id_monthly,
            stripe_price_id_yearly,
            features,
            limits,
            sort_order
          )
        `
        )
        .eq('id', tenantId)
        .maybeSingle();

      if (err) throw err;
      return data as unknown as TenantWithBilling | null;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  const plan = tenant?.tenant_plans;
  const planSlug: PlanSlug = (plan && typeof plan === 'object' && 'slug' in plan ? (plan as { slug: PlanSlug }).slug : 'free') ?? 'free';
  const billingStatus = tenant?.billing_status ?? 'active';

  const canUse = (feature: PlanFeature): boolean => canUseFeature(planSlug, feature);

  return {
    tenant,
    tenantId,
    planSlug: planSlug ?? 'free',
    billingStatus,
    canUse,
    isLoading: tenantLoading || planLoading,
    error,
  };
}
