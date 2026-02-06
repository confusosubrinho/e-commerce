-- Add Google Merchant Center and shipping fields to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS weight numeric,
ADD COLUMN IF NOT EXISTS width numeric,
ADD COLUMN IF NOT EXISTS height numeric,
ADD COLUMN IF NOT EXISTS depth numeric,
ADD COLUMN IF NOT EXISTS gtin text,
ADD COLUMN IF NOT EXISTS mpn text,
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS condition text DEFAULT 'new',
ADD COLUMN IF NOT EXISTS google_product_category text,
ADD COLUMN IF NOT EXISTS age_group text,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS material text,
ADD COLUMN IF NOT EXISTS pattern text,
ADD COLUMN IF NOT EXISTS seo_title text,
ADD COLUMN IF NOT EXISTS seo_description text,
ADD COLUMN IF NOT EXISTS seo_keywords text;

-- Add media_type column to product_images for video support
ALTER TABLE public.product_images
ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'image';

-- Create storage bucket for product media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media',
  'product-media',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for product media
CREATE POLICY "Anyone can view product media"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-media');

CREATE POLICY "Admins can upload product media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-media' AND is_admin());

CREATE POLICY "Admins can update product media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-media' AND is_admin());

CREATE POLICY "Admins can delete product media"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-media' AND is_admin());