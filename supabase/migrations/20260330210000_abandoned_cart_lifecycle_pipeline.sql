-- Operational lifecycle completion for abandoned carts
ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.abandoned_carts
    DROP CONSTRAINT IF EXISTS abandoned_carts_operational_status_check;

  ALTER TABLE public.abandoned_carts
    ADD CONSTRAINT abandoned_carts_operational_status_check
    CHECK (operational_status IN ('active', 'abandoned', 'expired', 'converted'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

UPDATE public.abandoned_carts
SET converted_at = COALESCE(converted_at, recovered_at, now())
WHERE operational_status = 'converted' AND converted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_lifecycle_dates
  ON public.abandoned_carts (tenant_id, operational_status, abandoned_at, expired_at, converted_at);
