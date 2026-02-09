
-- Add Bling mapping columns to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS bling_product_id BIGINT UNIQUE;

-- Add Bling mapping columns to product_variants
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS bling_variant_id BIGINT UNIQUE;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_products_bling_id ON public.products (bling_product_id) WHERE bling_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_variants_bling_id ON public.product_variants (bling_variant_id) WHERE bling_variant_id IS NOT NULL;
