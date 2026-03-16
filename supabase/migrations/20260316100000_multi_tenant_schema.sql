-- Fase 7 – Multi-tenant: schema base (todas as mudanças de schema no banco nesta migration)
-- 1. Tabela tenants + RLS + GRANT SELECT (anon, authenticated)
-- 2. Tenant padrão (loja atual)
-- 3. Coluna tenant_id nas tabelas de negócio + backfill + NOT NULL + DEFAULT
-- 4. Índices em tenant_id
-- RLS por tenant: migration 20260317100000_multi_tenant_rls.sql

-- =============================================
-- 1. Tabela tenants
-- =============================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  domain     TEXT UNIQUE,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenants IS 'Fase 7: Lojas (tenants). Uma linha por loja independente.';

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Política inicial: apenas admins e service_role (Super Admin depois pode ver todos)
CREATE POLICY "Service role full access tenants"
  ON public.tenants FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Admins can read tenants"
  ON public.tenants FOR SELECT
  USING (public.is_admin());

-- Leitura pública para tenant discovery futuro (ex.: resolver por domain)
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT ON public.tenants TO authenticated;

-- =============================================
-- 2. Tenant padrão (id fixo para DEFAULT nas FKs)
-- =============================================
INSERT INTO public.tenants (id, name, slug, domain, active)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Loja padrão',
  'default',
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 3. Coluna tenant_id + backfill (DEFAULT preenche existentes)
-- =============================================
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.integrations_checkout
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.integrations_checkout_providers
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Backfill: preencher registros existentes com o tenant padrão
UPDATE public.categories SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.products SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.product_variants SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.product_images SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.banners SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.coupons SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.customers SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.store_settings SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.orders SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.order_items SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.payments SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.inventory_movements SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.integrations_checkout SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE public.integrations_checkout_providers SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;

-- NOT NULL + DEFAULT para novos registros
ALTER TABLE public.categories ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.products ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.product_variants ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.product_images ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.banners ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.coupons ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.customers ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.store_settings ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.orders ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.order_items ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.payments ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.inventory_movements ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.integrations_checkout ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.integrations_checkout_providers ALTER COLUMN tenant_id SET NOT NULL, ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Índices para RLS e filtros por tenant (próxima fase)
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON public.categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_tenant_id ON public.product_variants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON public.orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON public.payments(tenant_id);
