-- Add Rede payment gateway fields to store_settings
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS rede_merchant_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rede_merchant_key text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rede_environment text DEFAULT 'sandbox';
