-- Tenant isolation para tabelas usadas no painel admin de Logs/Integrações
-- (app_logs, cleanup_runs, appmax_*, bling_* e configs)
-- Objetivo: impedir que admins de tenants diferentes leiam dados internos sem filtro por tenant_id.

DO $$
DECLARE
  v_default_tenant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- Logs / cron audit
  ALTER TABLE public.app_logs
    ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL DEFAULT public.get_current_tenant_id();

  ALTER TABLE public.cleanup_runs
    ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL DEFAULT public.get_current_tenant_id();

  -- Appmax / diagnostics
  ALTER TABLE public.appmax_settings
    ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL DEFAULT public.get_current_tenant_id();

  ALTER TABLE public.appmax_installations
    ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL DEFAULT public.get_current_tenant_id();

  ALTER TABLE public.appmax_logs
    ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL DEFAULT public.get_current_tenant_id();

  ALTER TABLE public.appmax_handshake_logs
    ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL DEFAULT public.get_current_tenant_id();

  -- Bling / diagnostics
  ALTER TABLE public.bling_webhook_logs
    ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL DEFAULT public.get_current_tenant_id();

  ALTER TABLE public.bling_sync_runs
    ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL DEFAULT public.get_current_tenant_id();

  ALTER TABLE public.bling_sync_config
    ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL DEFAULT public.get_current_tenant_id();
END $$;

-- Indexes (opcional, mas ajuda bastante no painel admin)
CREATE INDEX IF NOT EXISTS idx_app_logs_tenant_created ON public.app_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cleanup_runs_tenant_started ON public.cleanup_runs(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_appmax_logs_tenant_created ON public.appmax_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appmax_handshake_logs_tenant_created ON public.appmax_handshake_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bling_webhook_logs_tenant_received ON public.bling_webhook_logs(tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_bling_sync_runs_tenant_started ON public.bling_sync_runs(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_appmax_settings_tenant_env ON public.appmax_settings(tenant_id, environment);
CREATE INDEX IF NOT EXISTS idx_appmax_installations_tenant_env ON public.appmax_installations(tenant_id, environment);
CREATE INDEX IF NOT EXISTS idx_bling_sync_config_tenant_id ON public.bling_sync_config(tenant_id, id);

-- ============================
-- app_logs
-- ============================
DROP POLICY IF EXISTS "Admins can view app logs" ON public.app_logs;
DROP POLICY IF EXISTS "Admins can delete app logs" ON public.app_logs;
-- mantemos insert (edge/service)

CREATE POLICY "app_logs select tenant"
  ON public.app_logs
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

CREATE POLICY "app_logs delete tenant admin"
  ON public.app_logs
  FOR DELETE
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- ============================
-- cleanup_runs
-- ============================
DROP POLICY IF EXISTS "Admins can view cleanup_runs" ON public.cleanup_runs;

CREATE POLICY "cleanup_runs select tenant"
  ON public.cleanup_runs
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- ============================
-- appmax_settings
-- ============================
DROP POLICY IF EXISTS "Admins can manage appmax_settings" ON public.appmax_settings;
DROP POLICY IF EXISTS "Service can insert appmax_settings" ON public.appmax_settings;
DROP POLICY IF EXISTS "Service can update appmax_settings" ON public.appmax_settings;
DROP POLICY IF EXISTS "Service role can update appmax_settings" ON public.appmax_settings;
DROP POLICY IF EXISTS "Anyone can read appmax_settings" ON public.appmax_settings;

CREATE POLICY "appmax_settings tenant-scoped admin"
  ON public.appmax_settings
  FOR ALL
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- ============================
-- appmax_installations
-- ============================
DROP POLICY IF EXISTS "Admins can manage appmax_installations" ON public.appmax_installations;
DROP POLICY IF EXISTS "Admins can view appmax_installations" ON public.appmax_installations;

CREATE POLICY "appmax_installations tenant-scoped admin"
  ON public.appmax_installations
  FOR ALL
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- ============================
-- appmax_logs
-- ============================
DROP POLICY IF EXISTS "Admins can view appmax_logs" ON public.appmax_logs;
-- mantemos insert

CREATE POLICY "appmax_logs select tenant"
  ON public.appmax_logs
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- ============================
-- appmax_handshake_logs
-- ============================
DROP POLICY IF EXISTS "Admins can view handshake logs" ON public.appmax_handshake_logs;
DROP POLICY IF EXISTS "Admins can delete handshake logs" ON public.appmax_handshake_logs;

CREATE POLICY "appmax_handshake_logs select tenant"
  ON public.appmax_handshake_logs
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

CREATE POLICY "appmax_handshake_logs delete tenant"
  ON public.appmax_handshake_logs
  FOR DELETE
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- ============================
-- bling_webhook_logs
-- ============================
DROP POLICY IF EXISTS "Admins can manage webhook logs" ON public.bling_webhook_logs;

CREATE POLICY "bling_webhook_logs select tenant"
  ON public.bling_webhook_logs
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

CREATE POLICY "bling_webhook_logs update tenant admin"
  ON public.bling_webhook_logs
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  )
  WITH CHECK (
    tenant_id IS NOT NULL
  );

-- ============================
-- bling_sync_runs
-- ============================
DROP POLICY IF EXISTS "Admins can view sync runs" ON public.bling_sync_runs;

CREATE POLICY "bling_sync_runs select tenant"
  ON public.bling_sync_runs
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- ============================
-- bling_sync_config
-- ============================
DROP POLICY IF EXISTS "Admins can manage bling_sync_config" ON public.bling_sync_config;
DROP POLICY IF EXISTS "Anyone can view bling_sync_config" ON public.bling_sync_config;

CREATE POLICY "bling_sync_config tenant-scoped admin"
  ON public.bling_sync_config
  FOR ALL
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

