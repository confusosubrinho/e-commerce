-- Rate limit logging table for Edge Functions (prevents in-memory cold-start bypass).

CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_log_identifier_created_at
  ON public.rate_limit_log(identifier, created_at);

-- Atomic check + log in one statement.
-- Inserts one row only if current count within window is < p_max.
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

