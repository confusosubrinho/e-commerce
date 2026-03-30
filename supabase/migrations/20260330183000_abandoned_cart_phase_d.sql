-- Phase D: abandoned cart hardening (dedup + recovery traceability)
ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS cart_id TEXT,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS recovery_channel TEXT,
  ADD COLUMN IF NOT EXISTS converted_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recovery_events JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_tenant_cart_recent
  ON public.abandoned_carts (tenant_id, cart_id, created_at DESC)
  WHERE cart_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_last_activity
  ON public.abandoned_carts (tenant_id, last_activity_at DESC);
