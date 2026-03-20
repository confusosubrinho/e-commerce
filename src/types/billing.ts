/**
 * Tipos para billing dos lojistas (SaaS).
 * Alinhado com tenant_plans e colunas de billing em tenants.
 */

export type TenantBillingStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete';

export type PlanSlug = 'free' | 'starter' | 'pro' | 'enterprise';

/** Features que podem ser controladas por plano (ex.: relatórios avançados, domínio custom). */
export type PlanFeature =
  | 'checkout_stripe'
  | 'reports_basic'
  | 'reports_advanced'
  | 'custom_domain'
  | 'support_priority'
  | 'api_access'
  | 'white_label';

export interface TenantPlan {
  id: string;
  name: string;
  slug: PlanSlug;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  features: PlanFeature[];
  limits: PlanLimits;
  sort_order: number;
}

export interface PlanLimits {
  max_products?: number;
  max_orders_per_month?: number;
}

export interface TenantWithBilling {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  active: boolean;
  plan_id: string | null;
  billing_status: TenantBillingStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  plan_expires_at: string | null;
  tenant_plans?: TenantPlan | null;
}
