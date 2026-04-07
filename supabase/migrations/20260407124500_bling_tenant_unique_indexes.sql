-- Bling identifiers must be unique per tenant (not globally).
-- This avoids cross-tenant conflicts when different Bling accounts use overlapping IDs.

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_bling_product_id_key;

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_bling_variant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_bling_product_unique
  ON public.products (tenant_id, bling_product_id)
  WHERE bling_product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_tenant_bling_variant_unique
  ON public.product_variants (tenant_id, bling_variant_id)
  WHERE bling_variant_id IS NOT NULL;
