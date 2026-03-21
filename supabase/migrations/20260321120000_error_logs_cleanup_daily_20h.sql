-- Troca limpeza agressiva de error_logs (a cada 10 min) por job diário.
-- pg_cron no Supabase roda em UTC: 23:00 UTC ≈ 20:00 America/Sao_Paulo (UTC−3, sem horário de verão).
-- Ajuste a expressão se precisar de outro fuso ou horário.
--
-- Retenção: com limpeza diária, manter "older than 10 minutes" apagaria quase tudo só à noite
-- e ainda acumularia um dia inteiro de linhas; aqui removemos entradas com mais de 7 dias.
DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('cleanup_error_logs_10min', 'cleanup_error_logs_daily')
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup_error_logs_daily',
  '0 23 * * *',
  $$ DELETE FROM public.error_logs WHERE created_at < now() - interval '7 days' $$
);
