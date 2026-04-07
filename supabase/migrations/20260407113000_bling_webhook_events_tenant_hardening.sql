-- Bling webhook events: tenant hardening for multi-tenant safety
-- 1) enforce tenant_id presence
-- 2) idempotency unique key by (tenant_id, event_id)
-- 3) tenant-scoped admin read policy

UPDATE public.bling_webhook_events
SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE tenant_id IS NULL;

ALTER TABLE public.bling_webhook_events
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.bling_webhook_events
  DROP CONSTRAINT IF EXISTS bling_webhook_events_event_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bling_webhook_events_tenant_event_id
  ON public.bling_webhook_events (tenant_id, event_id);

CREATE INDEX IF NOT EXISTS idx_bling_webhook_events_tenant_status_created
  ON public.bling_webhook_events (tenant_id, status, created_at DESC);

DROP POLICY IF EXISTS "Admins can view webhook events" ON public.bling_webhook_events;
DROP POLICY IF EXISTS "bling_webhook_events select tenant" ON public.bling_webhook_events;

CREATE POLICY "bling_webhook_events select tenant"
  ON public.bling_webhook_events
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );
