
-- 1. Product variants Bling sync decision columns
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS bling_last_sync_decision text,
  ADD COLUMN IF NOT EXISTS bling_last_sync_source text,
  ADD COLUMN IF NOT EXISTS bling_last_match_type text;

-- 2. Rate limit log table + function
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_log_identifier_created_at
  ON public.rate_limit_log(identifier, created_at);

CREATE OR REPLACE FUNCTION public.rate_limit_check_and_log(
  p_identifier text,
  p_window_seconds integer,
  p_max integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE ok boolean;
BEGIN
  WITH recent AS (
    SELECT count(*)::int AS cnt
    FROM public.rate_limit_log
    WHERE identifier = p_identifier
      AND created_at > now() - (p_window_seconds || ' seconds')::interval
  ),
  ins AS (
    INSERT INTO public.rate_limit_log(identifier)
    SELECT p_identifier
    FROM recent
    WHERE recent.cnt < p_max
    RETURNING id
  )
  SELECT EXISTS(SELECT 1 FROM ins) INTO ok;
  RETURN ok;
END;
$$;

-- 3. Checkout sessions table
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  tenant_id UUID,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  coupon_code TEXT,
  coupon_id UUID,
  shipping_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_inconsistency_reason TEXT,
  yampi_link_id TEXT,
  correlation_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_order_id
  ON public.checkout_sessions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_expires_pending
  ON public.checkout_sessions(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status
  ON public.checkout_sessions(status);

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'checkout_sessions_service_role_only' AND tablename = 'checkout_sessions') THEN
    CREATE POLICY "checkout_sessions_service_role_only"
      ON public.checkout_sessions FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 4. Orders payment_status column
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders(payment_status) WHERE payment_status IS NOT NULL;

-- 5. Expire checkout sessions function
CREATE OR REPLACE FUNCTION public.expire_checkout_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE expired_count INTEGER;
BEGIN
  UPDATE public.checkout_sessions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending' AND expires_at < NOW();
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- 6. Bling webhook events tenant hardening
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
  ON public.bling_webhook_events FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- 7. Bling tenant unique indexes
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_bling_product_id_key;

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_bling_variant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_bling_product_unique
  ON public.products (tenant_id, bling_product_id) WHERE bling_product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_tenant_bling_variant_unique
  ON public.product_variants (tenant_id, bling_variant_id) WHERE bling_variant_id IS NOT NULL;
