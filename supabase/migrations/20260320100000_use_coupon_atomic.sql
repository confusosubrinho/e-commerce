-- Atomic coupon use check + increment to prevent race conditions.
-- Returns true when it managed to increment (and coupon is still active & within max_uses).

CREATE OR REPLACE FUNCTION public.use_coupon_atomic(p_coupon_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE ok boolean;
BEGIN
  UPDATE public.coupons
  SET uses_count = COALESCE(uses_count, 0) + 1
  WHERE id = p_coupon_id
    AND is_active = true
    AND (max_uses IS NULL OR COALESCE(uses_count, 0) < max_uses);

  GET DIAGNOSTICS ok = ROW_COUNT > 0;
  RETURN ok;
END;
$$;

