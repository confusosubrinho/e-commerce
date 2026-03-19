-- Tenant isolation for `highlight_banners`
-- Remove possibilidade de admin de um tenant visualizar/modificar banners de outros tenants.

ALTER TABLE public.highlight_banners
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Backfill: cai no tenant padrão para não deixar linhas sem tenant.
UPDATE public.highlight_banners
SET tenant_id = public.get_current_tenant_id()
WHERE tenant_id IS NULL;

ALTER TABLE public.highlight_banners
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_highlight_banners_tenant_display
  ON public.highlight_banners(tenant_id, display_order ASC);

ALTER TABLE public.highlight_banners ENABLE ROW LEVEL SECURITY;

-- Policies tenant-scoped
DROP POLICY IF EXISTS "highlight_banners select by tenant" ON public.highlight_banners;
DROP POLICY IF EXISTS "highlight_banners manage by tenant admin" ON public.highlight_banners;

CREATE POLICY "highlight_banners select by tenant"
  ON public.highlight_banners FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
    OR public.is_super_admin()
    OR (
      tenant_id = public.get_current_tenant_id()
      AND (
        is_active = true
        OR public.is_admin()
      )
    )
  );

CREATE POLICY "highlight_banners manage by tenant admin"
  ON public.highlight_banners FOR ALL
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
    OR public.is_super_admin()
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
    OR public.is_super_admin()
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

