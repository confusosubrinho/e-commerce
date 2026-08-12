ALTER VIEW public.store_settings_public SET (security_invoker = off);
GRANT SELECT ON public.store_settings_public TO anon, authenticated;
UPDATE public.store_settings SET header_highlight_text = 'Promoções', header_highlight_url = '/promocoes', header_highlight_icon = 'Percent';