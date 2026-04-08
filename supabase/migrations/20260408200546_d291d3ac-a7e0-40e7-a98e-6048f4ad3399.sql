-- 1. Tabela tenant_plans
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

ALTER TABLE public.tenant_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access tenant_plans"
  ON public.tenant_plans FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Anyone can read tenant_plans"
  ON public.tenant_plans FOR SELECT
  USING (true);

INSERT INTO public.tenant_plans (id, name, slug, stripe_price_id_monthly, stripe_price_id_yearly, features, limits, sort_order)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, 'Grátis', 'free', NULL, NULL, '[]', '{"max_products": 10, "max_orders_per_month": 50}', 0),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'Starter', 'starter', NULL, NULL, '["checkout_stripe", "reports_basic"]', '{"max_products": 100, "max_orders_per_month": 500}', 1),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'Pro', 'pro', NULL, NULL, '["checkout_stripe", "reports_advanced", "custom_domain", "support_priority"]', '{"max_products": 1000, "max_orders_per_month": 5000}', 2),
  ('10000000-0000-0000-0000-000000000004'::uuid, 'Enterprise', 'enterprise', NULL, NULL, '["checkout_stripe", "reports_advanced", "custom_domain", "support_priority", "api_access", "white_label"]', '{"max_products": -1, "max_orders_per_month": -1}', 3)
ON CONFLICT (slug) DO NOTHING;

-- 2. Colunas de billing em tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.tenant_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id
  ON public.tenants (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_stripe_subscription_id
  ON public.tenants (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_plan_id ON public.tenants (plan_id);
CREATE INDEX IF NOT EXISTS idx_tenants_billing_status ON public.tenants (billing_status);

UPDATE public.tenants
SET plan_id = '10000000-0000-0000-0000-000000000001'::uuid,
    billing_status = 'active'
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid AND plan_id IS NULL;

-- 3. orders.bling_order_id
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bling_order_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_orders_bling_order_id
  ON public.orders(bling_order_id)
  WHERE bling_order_id IS NOT NULL;

UPDATE public.orders
SET bling_order_id = (regexp_match(notes, 'bling_order_id:(\d+)'))[1]::bigint
WHERE notes LIKE '%bling_order_id:%' AND bling_order_id IS NULL;

-- 4. Bling tenant unique indexes (idempotent)
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_bling_product_id_key;
ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_bling_variant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_bling_product_unique
  ON public.products (tenant_id, bling_product_id)
  WHERE bling_product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_tenant_bling_variant_unique
  ON public.product_variants (tenant_id, bling_variant_id)
  WHERE bling_variant_id IS NOT NULL;