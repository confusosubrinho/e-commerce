-- Prioridade 1 – Billing dos lojistas (SaaS)
-- 1. Tabela tenant_plans (planos disponíveis)
-- 2. Colunas de billing em tenants
-- 3. Índices e comentários
-- Ver docs/ARCHITECTURE.md e guia-saas-super-admin.md

-- =============================================
-- 1. Tabela tenant_plans
-- =============================================
CREATE TABLE IF NOT EXISTS public.tenant_plans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly  TEXT,
  features   JSONB NOT NULL DEFAULT '[]',
  limits     JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_plans IS 'Planos de assinatura para lojistas (free, starter, pro, enterprise).';
COMMENT ON COLUMN public.tenant_plans.slug IS 'Identificador do plano: free, starter, pro, enterprise';
COMMENT ON COLUMN public.tenant_plans.stripe_price_id_monthly IS 'Stripe Price ID para cobrança mensal (null para free)';
COMMENT ON COLUMN public.tenant_plans.stripe_price_id_yearly IS 'Stripe Price ID para cobrança anual (null para free)';
COMMENT ON COLUMN public.tenant_plans.features IS 'Lista de features habilitadas no plano, ex: ["checkout_stripe", "reports_advanced"]';
COMMENT ON COLUMN public.tenant_plans.limits IS 'Limites do plano, ex: {"max_products": 100, "max_orders_per_month": 500}';

ALTER TABLE public.tenant_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access tenant_plans"
  ON public.tenant_plans FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Anyone can read tenant_plans"
  ON public.tenant_plans FOR SELECT
  USING (true);

GRANT SELECT ON public.tenant_plans TO anon;
GRANT SELECT ON public.tenant_plans TO authenticated;

-- Planos iniciais (slug usado no código; Stripe Price IDs preenchidos depois no Dashboard)
INSERT INTO public.tenant_plans (id, name, slug, stripe_price_id_monthly, stripe_price_id_yearly, features, limits, sort_order)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, 'Grátis', 'free', NULL, NULL, '[]', '{"max_products": 10, "max_orders_per_month": 50}', 0),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'Starter', 'starter', NULL, NULL, '["checkout_stripe", "reports_basic"]', '{"max_products": 100, "max_orders_per_month": 500}', 1),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'Pro', 'pro', NULL, NULL, '["checkout_stripe", "reports_advanced", "custom_domain", "support_priority"]', '{"max_products": 1000, "max_orders_per_month": 5000}', 2),
  ('10000000-0000-0000-0000-000000000004'::uuid, 'Enterprise', 'enterprise', NULL, NULL, '["checkout_stripe", "reports_advanced", "custom_domain", "support_priority", "api_access", "white_label"]', '{"max_products": -1, "max_orders_per_month": -1}', 3)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- 2. Colunas de billing em tenants
-- =============================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.tenant_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'active'
    CHECK (billing_status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.tenants.plan_id IS 'Plano atual do tenant (null = free ou não definido)';
COMMENT ON COLUMN public.tenants.billing_status IS 'Status da assinatura Stripe: active, trialing, past_due, canceled, unpaid, incomplete';
COMMENT ON COLUMN public.tenants.stripe_customer_id IS 'Stripe Customer ID para cobrança do lojista';
COMMENT ON COLUMN public.tenants.stripe_subscription_id IS 'Stripe Subscription ID quando há assinatura ativa';
COMMENT ON COLUMN public.tenants.trial_ends_at IS 'Fim do período de trial (14 dias típico)';
COMMENT ON COLUMN public.tenants.plan_expires_at IS 'Renovação prevista ou fim da assinatura';

-- Índices para webhook e lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id
  ON public.tenants (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_stripe_subscription_id
  ON public.tenants (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_plan_id ON public.tenants (plan_id);
CREATE INDEX IF NOT EXISTS idx_tenants_billing_status ON public.tenants (billing_status);

-- Tenant padrão: plano free
UPDATE public.tenants
SET plan_id = '10000000-0000-0000-0000-000000000001'::uuid,
    billing_status = 'active'
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid AND plan_id IS NULL;
