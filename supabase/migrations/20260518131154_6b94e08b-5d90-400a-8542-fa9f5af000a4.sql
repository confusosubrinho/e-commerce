
-- 1) bling_sync_config: drop public read, restrict to admins
DROP POLICY IF EXISTS "Anyone can view bling_sync_config" ON public.bling_sync_config;
DROP POLICY IF EXISTS "Admins can view bling_sync_config" ON public.bling_sync_config;
CREATE POLICY "Admins can view bling_sync_config"
ON public.bling_sync_config
FOR SELECT
TO authenticated
USING (is_admin() OR is_super_admin());

-- 2) inventory_movements: drop any tenant-based public SELECT, restrict to admins
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='inventory_movements' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.inventory_movements', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Admins can view inventory_movements"
ON public.inventory_movements
FOR SELECT
TO authenticated
USING (is_admin() OR is_super_admin());

-- 3) orders: remove overly broad user UPDATE policies; rely on existing trigger
-- prevent_sensitive_order_updates to block sensitive field changes by non-admins.
DROP POLICY IF EXISTS "Users can update their own orders limited" ON public.orders;
DROP POLICY IF EXISTS "Update orders by tenant" ON public.orders;
DROP POLICY IF EXISTS "Users can update notes on own orders" ON public.orders;

-- Allow users to update only their own orders; sensitive field guard is enforced by trigger.
CREATE POLICY "Users can update own orders (non-sensitive only)"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins retain full update capability
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (is_admin() OR is_super_admin())
WITH CHECK (is_admin() OR is_super_admin());

-- Ensure trigger exists to block sensitive field updates by non-admins
DROP TRIGGER IF EXISTS trg_prevent_sensitive_order_updates ON public.orders;
CREATE TRIGGER trg_prevent_sensitive_order_updates
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.prevent_sensitive_order_updates();
