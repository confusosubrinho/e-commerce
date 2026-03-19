-- Tenant isolation for admin team management (`admin_members`).
-- Corrige vazamento: policies atuais usam is_admin()/is_owner() sem escopar por tenant.

ALTER TABLE public.admin_members
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Backfill para evitar linhas sem tenant.
UPDATE public.admin_members
SET tenant_id = public.get_current_tenant_id()
WHERE tenant_id IS NULL;

ALTER TABLE public.admin_members
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_admin_members_tenant_created
  ON public.admin_members(tenant_id, created_at ASC);

-- Atualiza user_tenants para refletir tenant_id em admin_members
-- (importante para que get_current_tenant_id() funcione corretamente).
INSERT INTO public.user_tenants (user_id, tenant_id)
SELECT am.user_id, am.tenant_id
FROM public.admin_members am
WHERE am.user_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id;

-- Trigger: novos admins em admin_members ganham linha em user_tenants.
-- Usa NEW.tenant_id (com default = get_current_tenant_id()) para evitar "tenant padrão" hardcoded.
CREATE OR REPLACE FUNCTION public.fn_user_tenants_on_admin_member_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_tenants (user_id, tenant_id)
    VALUES (
      NEW.user_id,
      COALESCE(NEW.tenant_id, public.get_current_tenant_id())
    )
    ON CONFLICT (user_id) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

-- RLS: remove políticas antigas sem tenant.
DROP POLICY IF EXISTS "Owners can manage team" ON public.admin_members;
DROP POLICY IF EXISTS "Owners can manage admin_members" ON public.admin_members;
DROP POLICY IF EXISTS "Admins can view admin_members" ON public.admin_members;

-- Atualiza is_owner() para respeitar tenant_id (evita owner "global").
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_members am
    WHERE am.user_id = auth.uid()
      AND am.role = 'owner'
      AND am.is_active = true
      AND am.tenant_id = public.get_current_tenant_id()
  )
  OR
  -- fallback legado: se houver user_role admin dentro do mesmo tenant, trata como owner
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.user_tenants ut ON ut.user_id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ut.tenant_id = public.get_current_tenant_id()
  )
$$;

-- Select: admins do tenant veem o time daquele tenant.
CREATE POLICY "admin_members select by tenant"
  ON public.admin_members FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
    OR public.is_super_admin()
    OR (
      public.is_admin()
      AND tenant_id = public.get_current_tenant_id()
    )
  );

-- ALL: somente owners do tenant podem gerenciar membros.
CREATE POLICY "admin_members manage by tenant owner"
  ON public.admin_members FOR ALL
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
    OR public.is_super_admin()
    OR (
      public.is_owner()
      AND tenant_id = public.get_current_tenant_id()
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
    OR public.is_super_admin()
    OR (
      public.is_owner()
      AND tenant_id = public.get_current_tenant_id()
    )
  );

