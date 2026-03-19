-- Tenant isolation para `product_change_log`
-- Evita que admins de um tenant vejam histórico de alterações de outros tenants.

ALTER TABLE public.product_change_log
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Backfill via produtos (fonte da verdade do tenant).
UPDATE public.product_change_log pcl
SET tenant_id = p.tenant_id
FROM public.products p
WHERE p.id = pcl.product_id
  AND pcl.tenant_id IS NULL;

-- Fallback: se não achou produto, cai no tenant atual.
UPDATE public.product_change_log
SET tenant_id = public.get_current_tenant_id()
WHERE tenant_id IS NULL;

ALTER TABLE public.product_change_log
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_product_change_log_tenant_changed
  ON public.product_change_log(tenant_id, changed_at DESC);

-- Remove políticas antigas
DROP POLICY IF EXISTS "Admins can manage change log" ON public.product_change_log;

-- Policies tenant-scoped
CREATE POLICY "product_change_log select by tenant"
  ON public.product_change_log FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
    OR public.is_super_admin()
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

CREATE POLICY "product_change_log manage by tenant admin"
  ON public.product_change_log FOR ALL
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

