
-- Webhook logs table
CREATE TABLE public.bling_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL DEFAULT 'unknown',
  event_id text,
  bling_product_id bigint,
  payload_meta jsonb DEFAULT '{}'::jsonb,
  result text NOT NULL DEFAULT 'pending', -- updated, skipped, not_found, error, duplicate
  reason text,
  status_code int DEFAULT 200,
  processing_time_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bling_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage webhook logs"
  ON public.bling_webhook_logs FOR ALL
  USING (is_admin());

CREATE POLICY "Service can insert webhook logs"
  ON public.bling_webhook_logs FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_bling_webhook_logs_received ON public.bling_webhook_logs(received_at DESC);
CREATE INDEX idx_bling_webhook_logs_result ON public.bling_webhook_logs(result);

-- Sync runs table (cron audit)
CREATE TABLE public.bling_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger_type text NOT NULL DEFAULT 'cron', -- cron, manual, webhook
  processed_count int DEFAULT 0,
  updated_count int DEFAULT 0,
  errors_count int DEFAULT 0,
  error_details jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bling_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync runs"
  ON public.bling_sync_runs FOR SELECT
  USING (is_admin());

CREATE POLICY "Service can insert sync runs"
  ON public.bling_sync_runs FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_bling_sync_runs_started ON public.bling_sync_runs(started_at DESC);
