-- Vídeos "Inspire-se" passam a apontar para produtos da Shopify pelo handle.
ALTER TABLE public.instagram_videos ADD COLUMN IF NOT EXISTS product_handle text;
