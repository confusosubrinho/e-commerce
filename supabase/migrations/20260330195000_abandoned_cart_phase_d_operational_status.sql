-- Phase D (follow-up): add operational pipeline state for abandoned cart lifecycle.
ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS operational_status TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'abandoned_carts_operational_status_check'
  ) THEN
    ALTER TABLE public.abandoned_carts
      ADD CONSTRAINT abandoned_carts_operational_status_check
      CHECK (operational_status IN ('active', 'expired', 'converted'));
  END IF;
END $$;

UPDATE public.abandoned_carts
SET operational_status = 'converted'
WHERE (recovered = true OR status = 'recovered')
  AND operational_status <> 'converted';

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_operational_status
  ON public.abandoned_carts (tenant_id, operational_status, last_activity_at DESC);
