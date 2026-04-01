
-- 1. appmax_settings: remove public read policy
DROP POLICY IF EXISTS "Anyone can read appmax_settings" ON public.appmax_settings;

-- Also fix the overly permissive update policy
DROP POLICY IF EXISTS "Service role can update appmax_settings" ON public.appmax_settings;
CREATE POLICY "Admins can update appmax_settings"
  ON public.appmax_settings FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- 2. integrations_checkout_providers: restrict SELECT to admins only
DROP POLICY IF EXISTS "Select integrations_checkout_providers by tenant" ON public.integrations_checkout_providers;
DROP POLICY IF EXISTS "Anyone can read checkout providers" ON public.integrations_checkout_providers;

CREATE POLICY "Admins select integrations_checkout_providers"
  ON public.integrations_checkout_providers FOR SELECT
  USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- Create a minimal public view for storefront (no credentials)
CREATE OR REPLACE VIEW public.checkout_providers_public
  WITH (security_invoker = false)
AS
  SELECT provider, is_active, tenant_id
  FROM public.integrations_checkout_providers;

GRANT SELECT ON public.checkout_providers_public TO anon, authenticated;

-- 3. stock_notifications: remove the open INSERT policy
DROP POLICY IF EXISTS "Anyone can register stock interest" ON public.stock_notifications;

-- The existing tenant-aware INSERT policy remains
-- The existing admin ALL policies cover SELECT for admins

-- Add a SELECT policy for users to see their own notifications by email
CREATE POLICY "Users can view own stock notifications"
  ON public.stock_notifications FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR is_admin()
  );
