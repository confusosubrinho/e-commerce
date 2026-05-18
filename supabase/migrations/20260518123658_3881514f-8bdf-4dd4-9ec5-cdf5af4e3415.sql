-- 1) Recreate views with security_invoker
ALTER VIEW public.checkout_providers_public SET (security_invoker = on);
ALTER VIEW public.store_settings_public SET (security_invoker = on);

-- 2) Fix mutable search_path on functions
ALTER FUNCTION public.expire_checkout_sessions() SET search_path = public;
ALTER FUNCTION public.rate_limit_check_and_log(text, integer, integer) SET search_path = public;

-- 3) Restrict listing on public product-media bucket
DROP POLICY IF EXISTS "Anyone can view product media" ON storage.objects;

CREATE POLICY "Admins can list product media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'product-media' AND public.is_admin());