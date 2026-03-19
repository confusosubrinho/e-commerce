-- Tenant isolation for admin tracking panels (abandoned carts, traffic, email automations, audit log)
-- Goal: impedir que admins de tenants diferentes vejam registros internos sem escopo por tenant_id.

-- ============================
-- 0. Constantes
-- ============================
-- Tenant "default" usado quando não há mapeamento/override.
-- (Mantemos consistente com DEFAULT_TENANT_ID do repo.)
DO $$
DECLARE
  v_default_tenant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN

  -- ============================
  -- 1. Colunas tenant_id
  -- ============================
  ALTER TABLE public.abandoned_carts
    ADD COLUMN IF NOT EXISTS tenant_id uuid;

  ALTER TABLE public.traffic_sessions
    ADD COLUMN IF NOT EXISTS tenant_id uuid;

  ALTER TABLE public.email_automations
    ADD COLUMN IF NOT EXISTS tenant_id uuid;

  ALTER TABLE public.email_automation_logs
    ADD COLUMN IF NOT EXISTS tenant_id uuid;

  -- ============================
  -- 2. Backfills (quando possível)
  -- ============================
  -- abandoned_carts: tenta inferir tenant via orders.checkout_session_id = abandoned_carts.session_id
  UPDATE public.abandoned_carts ac
  SET tenant_id = o.tenant_id
  FROM public.orders o
  WHERE ac.tenant_id IS NULL
    AND o.checkout_session_id IS NOT NULL
    AND o.checkout_session_id = ac.session_id;

  -- traffic_sessions: tenta inferir tenant via abandoned_carts.session_id
  UPDATE public.traffic_sessions ts
  SET tenant_id = ac.tenant_id
  FROM public.abandoned_carts ac
  WHERE ts.tenant_id IS NULL
    AND ac.tenant_id IS NOT NULL
    AND ac.session_id = ts.session_id;

  -- email_automations: templates antigas ficam no tenant default
  UPDATE public.email_automations
  SET tenant_id = v_default_tenant
  WHERE tenant_id IS NULL;

  -- email_automation_logs: tenta herdar tenant via automation_id -> email_automations
  UPDATE public.email_automation_logs log
  SET tenant_id = a.tenant_id
  FROM public.email_automations a
  WHERE log.tenant_id IS NULL
    AND log.automation_id = a.id
    AND a.tenant_id IS NOT NULL;

  -- ============================
  -- 3. Índices (performance + garantias de busca)
  -- ============================
  CREATE INDEX IF NOT EXISTS idx_abandoned_carts_tenant_created
    ON public.abandoned_carts (tenant_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_traffic_sessions_tenant_created
    ON public.traffic_sessions (tenant_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_email_automations_tenant_type
    ON public.email_automations (tenant_id, automation_type, trigger_event);
  CREATE INDEX IF NOT EXISTS idx_email_automation_logs_tenant_created
    ON public.email_automation_logs (tenant_id, created_at DESC);

END $$;

-- ============================
-- 4. RLS - abandoned_carts
-- ============================
DROP POLICY IF EXISTS "Admins can manage abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Anyone can insert abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Users can view own abandoned carts" ON public.abandoned_carts;

CREATE POLICY "abandoned_carts select tenant or own user"
  ON public.abandoned_carts
  FOR SELECT
  USING (
    (public.is_super_admin())
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_admin()
      AND tenant_id = public.get_current_tenant_id()
    )
    OR (
      user_id = auth.uid()
    )
  );

CREATE POLICY "abandoned_carts insert requires tenant_id"
  ON public.abandoned_carts
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
    OR tenant_id IS NOT NULL
  );

CREATE POLICY "abandoned_carts update by tenant admin/own user"
  ON public.abandoned_carts
  FOR UPDATE
  USING (
    (public.is_super_admin())
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_admin()
      AND tenant_id = public.get_current_tenant_id()
    )
    OR (
      user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IS NOT NULL
    AND (
      (public.is_super_admin())
      OR (auth.jwt() ->> 'role') = 'service_role'
      OR (
        public.is_admin()
        AND tenant_id = public.get_current_tenant_id()
      )
      OR (
        user_id = auth.uid()
      )
    )
  );

CREATE POLICY "abandoned_carts delete by tenant admin"
  ON public.abandoned_carts
  FOR DELETE
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_admin()
      AND tenant_id = public.get_current_tenant_id()
    )
  );

-- ============================
-- 5. RLS - traffic_sessions
-- ============================
DROP POLICY IF EXISTS "Admins can manage traffic sessions" ON public.traffic_sessions;
DROP POLICY IF EXISTS "Anyone can insert traffic sessions" ON public.traffic_sessions;

CREATE POLICY "traffic_sessions select by tenant admin"
  ON public.traffic_sessions
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_admin()
      AND tenant_id = public.get_current_tenant_id()
    )
  );

CREATE POLICY "traffic_sessions insert requires tenant_id"
  ON public.traffic_sessions
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
    OR tenant_id IS NOT NULL
  );

CREATE POLICY "traffic_sessions update by tenant admin"
  ON public.traffic_sessions
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_admin()
      AND tenant_id = public.get_current_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id IS NOT NULL
  );

CREATE POLICY "traffic_sessions delete by tenant admin"
  ON public.traffic_sessions
  FOR DELETE
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_admin()
      AND tenant_id = public.get_current_tenant_id()
    )
  );

-- ============================
-- 6. RLS - email_automations
-- ============================
DROP POLICY IF EXISTS "Admins can manage email automations" ON public.email_automations;

CREATE POLICY "email_automations tenant-scoped admin"
  ON public.email_automations
  FOR ALL
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_admin()
      AND tenant_id = public.get_current_tenant_id()
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_admin()
      AND tenant_id = public.get_current_tenant_id()
    )
  );

-- ============================
-- 7. RLS - email_automation_logs
-- ============================
DROP POLICY IF EXISTS "Admins can manage email logs" ON public.email_automation_logs;

CREATE POLICY "email_automation_logs tenant-scoped select"
  ON public.email_automation_logs
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_admin()
      AND tenant_id = public.get_current_tenant_id()
    )
  );

CREATE POLICY "email_automation_logs tenant-scoped insert"
  ON public.email_automation_logs
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_super_admin()
      OR (
        public.is_admin()
        AND tenant_id = public.get_current_tenant_id()
      )
    )
  );

CREATE POLICY "email_automation_logs tenant-scoped update"
  ON public.email_automation_logs
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_admin()
      AND tenant_id = public.get_current_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id IS NOT NULL
  );

CREATE POLICY "email_automation_logs tenant-scoped delete"
  ON public.email_automation_logs
  FOR DELETE
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_admin()
      AND tenant_id = public.get_current_tenant_id()
    )
  );

-- ============================
-- 8. RLS - admin_audit_log (via user_tenants)
-- ============================
DROP POLICY IF EXISTS "Admins can view audit log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "System can insert audit log" ON public.admin_audit_log;

CREATE POLICY "admin_audit_log select by admin tenant"
  ON public.admin_audit_log
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_admin()
      AND EXISTS (
        SELECT 1
        FROM public.user_tenants ut
        WHERE ut.user_id = admin_audit_log.user_id
          AND ut.tenant_id = public.get_current_tenant_id()
      )
    )
  );

CREATE POLICY "admin_audit_log insert by admin own tenant"
  ON public.admin_audit_log
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.user_tenants ut
        WHERE ut.user_id = auth.uid()
          AND ut.tenant_id = public.get_current_tenant_id()
      )
    )
  );

