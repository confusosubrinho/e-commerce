-- Bling foi aposentado: Shopify é a fonte de catálogo e estoque.
-- Não remove dados, colunas, RPCs de estoque ou dependências da Yampi.
-- Rollback: restaurar as flags de bling_sync_config a partir do backup de
-- staging/produção e reativar somente os jobs Bling previamente ativos.
-- Os registros de cron.job são mantidos para permitir a reversão.
DO $$
BEGIN
  IF to_regclass('public.bling_sync_config') IS NOT NULL THEN
    UPDATE public.bling_sync_config
    SET import_new_products = false,
        merge_by_sku = false,
        sync_stock = false,
        sync_titles = false,
        sync_descriptions = false,
        sync_images = false,
        sync_prices = false,
        sync_dimensions = false,
        sync_sku_gtin = false,
        sync_variant_active = false;
  END IF;

  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := jobid, active := false)
    FROM cron.job
    WHERE command ~* '/functions/v1/bling-(sync|sync-single-stock|webhook|oauth)([^a-z_-]|$)';
  END IF;
END $$;
