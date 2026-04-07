
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limit_log_service_role_only"
  ON public.rate_limit_log FOR ALL
  USING (auth.role() = 'service_role');
