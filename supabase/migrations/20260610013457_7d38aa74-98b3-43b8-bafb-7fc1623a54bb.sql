
-- Aceitar IDs Shopify (texto gid://) em product_reviews e stock_notifications
ALTER TABLE public.product_reviews
  ALTER COLUMN product_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS shopify_product_id text;

ALTER TABLE public.product_reviews
  DROP CONSTRAINT IF EXISTS product_reviews_product_ref_chk;
ALTER TABLE public.product_reviews
  ADD CONSTRAINT product_reviews_product_ref_chk
  CHECK (product_id IS NOT NULL OR shopify_product_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_product_reviews_shopify_product_id
  ON public.product_reviews(shopify_product_id);

ALTER TABLE public.stock_notifications
  ALTER COLUMN product_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS shopify_product_id text,
  ADD COLUMN IF NOT EXISTS shopify_variant_id text;

ALTER TABLE public.stock_notifications
  DROP CONSTRAINT IF EXISTS stock_notifications_product_ref_chk;
ALTER TABLE public.stock_notifications
  ADD CONSTRAINT stock_notifications_product_ref_chk
  CHECK (product_id IS NOT NULL OR shopify_product_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_stock_notif_shopify_email
  ON public.stock_notifications (
    lower(email),
    coalesce(shopify_product_id, ''),
    coalesce(shopify_variant_id, '')
  )
  WHERE shopify_product_id IS NOT NULL AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_notif_shopify_product_id
  ON public.stock_notifications(shopify_product_id);
