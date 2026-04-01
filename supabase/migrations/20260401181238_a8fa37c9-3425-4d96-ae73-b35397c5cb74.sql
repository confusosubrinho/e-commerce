
-- 1. Add missing columns to coupons
ALTER TABLE public.coupons 
  ADD COLUMN IF NOT EXISTS start_date timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exclude_sale_products boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS per_user_limit integer DEFAULT NULL;

-- 2. Create coupon_uses tracking table
CREATE TABLE IF NOT EXISTS public.coupon_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  user_id uuid DEFAULT NULL,
  order_id uuid DEFAULT NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_uses_coupon_id ON public.coupon_uses(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_email ON public.coupon_uses(coupon_id, user_email);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_tenant ON public.coupon_uses(tenant_id);

ALTER TABLE public.coupon_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage coupon_uses by tenant"
  ON public.coupon_uses
  FOR ALL
  USING (
    is_admin() AND (
      tenant_id = get_current_tenant_id() OR is_super_admin() OR (auth.jwt() ->> 'role' = 'service_role')
    )
  );

CREATE POLICY "Service role full access coupon_uses"
  ON public.coupon_uses
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- 3. Atomic coupon use function (global limit only)
CREATE OR REPLACE FUNCTION public.use_coupon_atomic(p_coupon_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_current integer;
BEGIN
  -- Lock the row to prevent concurrent updates
  SELECT max_uses, COALESCE(uses_count, 0)
  INTO v_max, v_current
  FROM public.coupons
  WHERE id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- If no max_uses limit, always allow
  IF v_max IS NULL THEN
    UPDATE public.coupons 
    SET uses_count = v_current + 1, updated_at = now()
    WHERE id = p_coupon_id;
    RETURN true;
  END IF;

  -- Check limit
  IF v_current >= v_max THEN
    RETURN false;
  END IF;

  UPDATE public.coupons 
  SET uses_count = v_current + 1, updated_at = now()
  WHERE id = p_coupon_id;
  RETURN true;
END;
$$;

-- 4. Atomic coupon use with per-user check
CREATE OR REPLACE FUNCTION public.use_coupon_atomic_per_user(
  p_coupon_id uuid,
  p_user_email text,
  p_user_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_current integer;
  v_per_user integer;
  v_user_uses integer;
BEGIN
  SELECT max_uses, COALESCE(uses_count, 0), per_user_limit
  INTO v_max, v_current, v_per_user
  FROM public.coupons
  WHERE id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check global limit
  IF v_max IS NOT NULL AND v_current >= v_max THEN
    RETURN false;
  END IF;

  -- Check per-user limit
  IF v_per_user IS NOT NULL AND p_user_email IS NOT NULL THEN
    SELECT count(*) INTO v_user_uses
    FROM public.coupon_uses
    WHERE coupon_id = p_coupon_id AND lower(user_email) = lower(p_user_email);

    IF v_user_uses >= v_per_user THEN
      RETURN false;
    END IF;
  END IF;

  -- Increment global counter
  UPDATE public.coupons 
  SET uses_count = v_current + 1, updated_at = now()
  WHERE id = p_coupon_id;

  -- Record usage
  INSERT INTO public.coupon_uses (coupon_id, user_email, user_id, order_id, tenant_id)
  VALUES (p_coupon_id, lower(p_user_email), p_user_id, p_order_id, p_tenant_id);

  RETURN true;
END;
$$;
