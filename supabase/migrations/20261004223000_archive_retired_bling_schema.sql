-- Aplicar somente após retirar TODOS os deployments Bling e publicar o helper
-- inerte em seus consumidores. Testar em staging e guardar pg_dump do schema.
-- Não remove tabelas/colunas Yampi, estoque, produtos, clientes ou pedidos.
-- Histórico exclusivo do Bling fica em schema privado para recuperação.
BEGIN;

CREATE SCHEMA IF NOT EXISTS retired_integrations;
REVOKE ALL ON SCHEMA retired_integrations FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  target_table text;
  column_names text;
  target_column text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'bling_sync_config', 'bling_sync_runs',
    'bling_webhook_events', 'bling_webhook_logs'
  ] LOOP
    IF to_regclass(format('public.%I', target_table)) IS NOT NULL THEN
      -- RESTRICT aborta a transação se houver dependência desconhecida.
      EXECUTE format('CREATE TABLE retired_integrations.%I AS TABLE public.%I', target_table, target_table);
      EXECUTE format('ALTER TABLE retired_integrations.%I ENABLE ROW LEVEL SECURITY', target_table);
      EXECUTE format('DROP TABLE public.%I RESTRICT', target_table);
    END IF;
  END LOOP;

  FOREACH target_table IN ARRAY ARRAY['products', 'product_variants', 'orders', 'store_settings'] LOOP
    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO column_names
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = target_table
      AND c.column_name LIKE 'bling\_%' ESCAPE '\';

    IF column_names IS NOT NULL THEN
      EXECUTE format(
        'CREATE TABLE retired_integrations.%I AS SELECT id, %s FROM public.%I',
        target_table || '_bling_columns', column_names, target_table
      );
      EXECUTE format('ALTER TABLE retired_integrations.%I ENABLE ROW LEVEL SECURITY', target_table || '_bling_columns');
      FOR target_column IN
        SELECT c.column_name FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = target_table
          AND c.column_name LIKE 'bling\_%' ESCAPE '\'
      LOOP
        EXECUTE format('ALTER TABLE public.%I DROP COLUMN %I RESTRICT', target_table, target_column);
      END LOOP;
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA retired_integrations FROM PUBLIC, anon, authenticated;
COMMIT;

-- Rollback: restaurar definições das quatro tabelas e das colunas bling_* do
-- pg_dump feito antes da migration (incluindo índices, constraints e RLS).
-- Inserir os registros das tabelas arquivadas e repor colunas usando JOIN por id.
-- Não restaurar todo o banco: isso sobrescreveria pedidos posteriores ao deploy.
-- Credenciais arquivadas devem ser revogadas no Bling após a retirada definitiva.
