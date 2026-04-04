-- Telemetria da última decisão de sync de estoque Bling (por variante)
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS bling_last_sync_decision text,
  ADD COLUMN IF NOT EXISTS bling_last_sync_source text,
  ADD COLUMN IF NOT EXISTS bling_last_match_type text;

COMMENT ON COLUMN public.product_variants.bling_last_sync_decision IS 'Última decisão resolveSafeStockUpdate (ex.: would_update, skipped_recent_local_movement)';
COMMENT ON COLUMN public.product_variants.bling_last_sync_source IS 'Origem (ex.: bling-sync.syncStock, webhook.batchStockSync)';
COMMENT ON COLUMN public.product_variants.bling_last_match_type IS 'Tipo de match: bling_variant_id, bling_product_id_parent, sku_relink, none';
