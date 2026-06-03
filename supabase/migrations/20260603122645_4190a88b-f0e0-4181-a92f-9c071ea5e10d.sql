ALTER TABLE public.home_sections
  ADD COLUMN IF NOT EXISTS shopify_collection_handle text,
  ADD COLUMN IF NOT EXISTS shopify_product_handles text[] DEFAULT '{}'::text[];