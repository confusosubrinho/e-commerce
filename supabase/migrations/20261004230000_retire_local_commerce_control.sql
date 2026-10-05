-- Shopify gerencia a operação; Yampi permanece somente no redirecionamento
-- público do carrinho. Este SQL não afeta src/config/checkout.ts.
-- Pré-requisitos: excluir os endpoints aposentados, publicar Stripe Billing e
-- cron-cleanup-logs atualizados, guardar pg_dump e testar em staging.
BEGIN;

CREATE SCHEMA IF NOT EXISTS retired_integrations;
REVOKE ALL ON SCHEMA retired_integrations FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS retired_integrations.operational_definitions (
  kind text NOT NULL,
  identity text NOT NULL,
  definition text NOT NULL,
  PRIMARY KEY (kind, identity)
);
ALTER TABLE retired_integrations.operational_definitions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_name text;
  target_column text;
  column_names text;
  object_record record;
BEGIN
  -- Desativa somente jobs dos endpoints aposentados e da expiração local.
  -- Stripe Billing (checkout-stripe-webhook), SEO e logs técnicos permanecem.
  IF to_regclass('cron.job') IS NOT NULL THEN
    UPDATE cron.job SET active = false
    WHERE command ~* '/functions/v1/(yampi-[a-z-]+|appmax-[a-z-]+|checkout-(router|calculate-shipping|create-session|expire-sessions|process-payment|reconcile-order|release-expired-reservations|reprocess-stripe-webhook|stripe-catalog-sync|stripe-create-intent|update-settings)|admin-commerce-action|integrations-test|integrations-tray-import)([^a-z_-]|$)'
       OR command ~* '(public\.)?expire_checkout_sessions\s*\(';
  END IF;

  FOREACH target_name IN ARRAY ARRAY['checkout_settings', 'checkout_providers_public'] LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = target_name AND c.relkind = 'v') THEN
      INSERT INTO retired_integrations.operational_definitions
      VALUES ('view', target_name, format('CREATE VIEW public.%I AS %s', target_name,
        pg_get_viewdef(format('public.%I', target_name)::regclass, true)))
      ON CONFLICT DO NOTHING;
      EXECUTE format('DROP VIEW public.%I RESTRICT', target_name);
    END IF;
  END LOOP;

  -- Retira os triggers que produziam notificações de estoque local.
  FOR object_record IN
    SELECT t.tgname, t.tgrelid::regclass AS relation, pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE NOT t.tgisinternal AND n.nspname = 'public'
      AND p.proname IN ('notify_zero_stock', 'mark_stock_notifications_when_back')
  LOOP
    INSERT INTO retired_integrations.operational_definitions
    VALUES ('trigger', object_record.relation || '.' || object_record.tgname, object_record.definition)
    ON CONFLICT DO NOTHING;
    EXECUTE format('DROP TRIGGER %I ON %s RESTRICT', object_record.tgname, object_record.relation);
  END LOOP;

  FOR object_record IN
    SELECT p.oid::regprocedure AS signature, pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'cancel_order_return_stock', 'decrement_stock', 'increment_stock',
      'expire_checkout_sessions', 'notify_zero_stock', 'mark_stock_notifications_when_back'
    )
  LOOP
    INSERT INTO retired_integrations.operational_definitions
    VALUES ('function', object_record.signature::text, object_record.definition)
    ON CONFLICT DO NOTHING;
    EXECUTE format('DROP FUNCTION %s RESTRICT', object_record.signature);
  END LOOP;

  FOREACH target_name IN ARRAY ARRAY[
    'appmax_handshake_logs', 'appmax_installations', 'appmax_logs',
    'appmax_settings', 'appmax_tokens_cache',
    'integrations_checkout_test_logs', 'integrations_checkout_providers',
    'integrations_checkout', 'checkout_settings_audit', 'checkout_settings',
    'checkout_settings_canonical', 'catalog_sync_runs', 'variation_value_map',
    'stock_notifications'
  ] LOOP
    IF to_regclass(format('public.%I', target_name)) IS NOT NULL THEN
      EXECUTE format('CREATE TABLE retired_integrations.%I AS TABLE public.%I', target_name, target_name);
      EXECUTE format('ALTER TABLE retired_integrations.%I ENABLE ROW LEVEL SECURITY', target_name);
      EXECUTE format('DROP TABLE public.%I RESTRICT', target_name);
    END IF;
  END LOOP;

  -- Metadados exclusivos de sincronização externa; dados de negócio continuam.
  FOREACH target_name IN ARRAY ARRAY[
    'categories', 'product_images', 'product_variants', 'products',
    'order_items', 'orders', 'inventory_movements'
  ] LOOP
    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
      INTO column_names FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = target_name
      AND c.column_name LIKE 'yampi\_%' ESCAPE '\';
    IF column_names IS NOT NULL THEN
      EXECUTE format('CREATE TABLE retired_integrations.%I AS SELECT id, %s FROM public.%I',
        target_name || '_yampi_columns', column_names, target_name);
      EXECUTE format('ALTER TABLE retired_integrations.%I ENABLE ROW LEVEL SECURITY', target_name || '_yampi_columns');
      FOR target_column IN
        SELECT c.column_name FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = target_name
          AND c.column_name LIKE 'yampi\_%' ESCAPE '\'
      LOOP
        EXECUTE format('ALTER TABLE public.%I DROP COLUMN %I RESTRICT', target_name, target_column);
      END LOOP;
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA retired_integrations FROM PUBLIC, anon, authenticated;
COMMIT;

-- Rollback: restaurar schema/índices/FKs/RLS/grants das tabelas e colunas usando
-- pg_dump anterior; repor os dados arquivados (metadados por id). Restaurar
-- functions/views/triggers de operational_definitions na ordem das dependências.
-- Reativar apenas jobs que estavam ativos e republicar os endpoints necessários.
-- Não restaurar todo o banco, para não sobrescrever pedidos posteriores.
-- Não há CASCADE: dependências inesperadas abortam a transação completa.
