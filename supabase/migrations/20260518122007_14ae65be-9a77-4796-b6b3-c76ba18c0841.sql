
-- 1. store_settings: drop public read of base table (credentials exposure)
DROP POLICY IF EXISTS "Public read default tenant store_settings" ON public.store_settings;

-- 2. orders & order_items: remove guest-access via "user_id IS NULL AND access_token IS NOT NULL"
DROP POLICY IF EXISTS "Select orders by tenant" ON public.orders;
CREATE POLICY "Select orders by tenant" ON public.orders
  FOR SELECT
  USING (
    ((user_id = auth.uid()) OR is_admin())
    AND ((tenant_id = get_current_tenant_id()) OR is_super_admin() OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text))
  );

DROP POLICY IF EXISTS "Update orders by tenant" ON public.orders;
CREATE POLICY "Update orders by tenant" ON public.orders
  FOR UPDATE
  USING (
    ((user_id = auth.uid()) OR is_admin())
    AND ((tenant_id = get_current_tenant_id()) OR is_super_admin() OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text))
  );

DROP POLICY IF EXISTS "Select order_items by tenant" ON public.order_items;
CREATE POLICY "Select order_items by tenant" ON public.order_items
  FOR SELECT
  USING (
    ((tenant_id = get_current_tenant_id()) OR is_super_admin() OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text))
    AND (
      is_admin() OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
      )
    )
  );

-- 3. help_articles: restrict admin-audience to admins
DROP POLICY IF EXISTS "Anyone can read help articles" ON public.help_articles;
CREATE POLICY "Public read non-admin help articles" ON public.help_articles
  FOR SELECT
  USING (audience IS DISTINCT FROM 'admin' OR is_admin());

-- 4. Log tables: restrict inserts to service_role / admin
DROP POLICY IF EXISTS "Insert errors" ON public.error_logs;
CREATE POLICY "Insert errors" ON public.error_logs
  FOR INSERT
  WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role') OR is_admin());

DROP POLICY IF EXISTS "Service can insert app logs" ON public.app_logs;
CREATE POLICY "Service can insert app logs" ON public.app_logs
  FOR INSERT
  WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role') OR is_admin());

DROP POLICY IF EXISTS "Service can insert webhook logs" ON public.bling_webhook_logs;
CREATE POLICY "Service can insert webhook logs" ON public.bling_webhook_logs
  FOR INSERT
  WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role') OR is_admin());

DROP POLICY IF EXISTS "Anyone can insert traffic sessions" ON public.traffic_sessions;
CREATE POLICY "Service can insert traffic sessions" ON public.traffic_sessions
  FOR INSERT
  WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role') OR is_admin());

-- 5. catalog_sync_queue: restrict insert/update to service_role / admin
DROP POLICY IF EXISTS "Service can insert catalog_sync_queue" ON public.catalog_sync_queue;
CREATE POLICY "Service can insert catalog_sync_queue" ON public.catalog_sync_queue
  FOR INSERT
  WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role') OR is_admin());

DROP POLICY IF EXISTS "Service can update catalog_sync_queue" ON public.catalog_sync_queue;
CREATE POLICY "Service can update catalog_sync_queue" ON public.catalog_sync_queue
  FOR UPDATE
  USING (((auth.jwt() ->> 'role'::text) = 'service_role') OR is_admin());

-- 6. is_owner(): remove user_roles admin fallback (privilege escalation)
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_members
    WHERE user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
  )
$function$;

-- 7. Realtime: stop broadcasting orders to all subscribers
ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
