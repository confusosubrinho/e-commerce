
CREATE OR REPLACE VIEW public.checkout_providers_public
  WITH (security_invoker = false)
AS
  SELECT 
    provider, 
    is_active, 
    tenant_id,
    CASE 
      WHEN provider = 'stripe' THEN (config->>'publishable_key')
      ELSE NULL
    END AS publishable_key,
    CASE 
      WHEN provider = 'stripe' THEN (config->>'checkout_mode')
      ELSE NULL
    END AS checkout_mode
  FROM public.integrations_checkout_providers;

GRANT SELECT ON public.checkout_providers_public TO anon, authenticated;
