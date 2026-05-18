
-- 1) Orders: prevent users from modifying sensitive fields
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users update own orders" ON public.orders;
DROP POLICY IF EXISTS "users_update_own_orders" ON public.orders;

CREATE OR REPLACE FUNCTION public.prevent_sensitive_order_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins and service role to update anything
  IF is_admin() OR is_super_admin() OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.shipping_cost IS DISTINCT FROM OLD.shipping_cost
     OR NEW.coupon_code IS DISTINCT FROM OLD.coupon_code
     OR NEW.customer_cpf IS DISTINCT FROM OLD.customer_cpf
     OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.order_number IS DISTINCT FROM OLD.order_number
  THEN
    RAISE EXCEPTION 'Sensitive order fields can only be modified by admins or backend services';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_sensitive_order_updates_trg ON public.orders;
CREATE TRIGGER prevent_sensitive_order_updates_trg
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_sensitive_order_updates();

CREATE POLICY "Users can update their own orders limited"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2) inventory_movements: restrict reads to admins / service role only
DROP POLICY IF EXISTS "Tenant can view inventory movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "inventory_movements_select" ON public.inventory_movements;
DROP POLICY IF EXISTS "Inventory movements select" ON public.inventory_movements;

CREATE POLICY "Admins can view inventory movements"
ON public.inventory_movements
FOR SELECT
TO authenticated
USING (is_admin() OR is_super_admin());
