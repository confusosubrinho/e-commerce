-- Fix orders SELECT policy: allow guest access via access_token
DROP POLICY IF EXISTS "Select orders by tenant" ON public.orders;
CREATE POLICY "Select orders by tenant" ON public.orders
  FOR SELECT USING (
    (
      -- Authenticated user owns the order
      (user_id = auth.uid())
      -- Guest checkout: user_id is null but has access_token
      OR (user_id IS NULL AND access_token IS NOT NULL)
      -- Admin access
      OR is_admin()
    )
    AND (
      tenant_id = get_current_tenant_id()
      OR is_super_admin()
      OR (auth.jwt() ->> 'role' = 'service_role')
    )
  );

-- Fix orders UPDATE policy: allow guest access via access_token
DROP POLICY IF EXISTS "Update orders by tenant" ON public.orders;
CREATE POLICY "Update orders by tenant" ON public.orders
  FOR UPDATE USING (
    (
      (user_id = auth.uid())
      OR (user_id IS NULL AND access_token IS NOT NULL)
      OR is_admin()
    )
    AND (
      tenant_id = get_current_tenant_id()
      OR is_super_admin()
      OR (auth.jwt() ->> 'role' = 'service_role')
    )
  );

-- Fix orders INSERT policy: also allow anonymous inserts for guest checkout
DROP POLICY IF EXISTS "Insert orders in tenant" ON public.orders;
CREATE POLICY "Insert orders in tenant" ON public.orders
  FOR INSERT WITH CHECK (
    tenant_id = get_current_tenant_id()
    OR is_super_admin()
    OR (auth.jwt() ->> 'role' = 'service_role')
  );

-- Fix order_items SELECT policy: allow guest access through order's access_token
DROP POLICY IF EXISTS "Select order_items by tenant" ON public.order_items;
CREATE POLICY "Select order_items by tenant" ON public.order_items
  FOR SELECT USING (
    (
      tenant_id = get_current_tenant_id()
      OR is_super_admin()
      OR (auth.jwt() ->> 'role' = 'service_role')
    )
    AND (
      is_admin()
      OR EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_items.order_id
        AND (
          o.user_id = auth.uid()
          OR (o.user_id IS NULL AND o.access_token IS NOT NULL)
        )
      )
    )
  );