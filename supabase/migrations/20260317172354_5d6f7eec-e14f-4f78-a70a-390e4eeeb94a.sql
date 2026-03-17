-- Ensure anon and authenticated roles can read the store_settings_public view
GRANT SELECT ON public.store_settings_public TO anon, authenticated;