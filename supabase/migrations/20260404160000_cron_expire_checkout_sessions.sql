-- ============================================================
-- Cron: expira checkout_sessions a cada 15 minutos via pg_cron
-- ============================================================
-- Requer a extensão pg_cron habilitada no projeto Supabase.
-- Para habilitar: Project Settings → Database → Extensions → pg_cron.
--
-- A função expire_checkout_sessions() foi criada na migration anterior
-- (20260404150000_yampi_checkout_sessions_and_price_guard.sql).
-- ============================================================

-- Habilita pg_cron se não estiver (idempotente)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove job existente com o mesmo nome (para permitir re-execução idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('expire-checkout-sessions');
EXCEPTION
  WHEN OTHERS THEN NULL; -- Job não existia, ok
END;
$$;

-- Agenda: a cada 15 minutos
SELECT cron.schedule(
  'expire-checkout-sessions',       -- nome do job
  '*/15 * * * *',                   -- cron: a cada 15 minutos
  $$
    SELECT public.expire_checkout_sessions();
  $$
);

COMMENT ON EXTENSION pg_cron IS
  'pg_cron: agendador de jobs SQL (usado para expirar checkout_sessions)';
