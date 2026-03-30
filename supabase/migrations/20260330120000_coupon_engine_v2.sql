-- Coupon engine v2: extensible rules/effects + audit/usage tables
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS campaign_tag TEXT,
  ADD COLUMN IF NOT EXISTS internal_note TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused','expired','exhausted')),
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_purchase_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS usage_per_customer INTEGER,
  ADD COLUMN IF NOT EXISTS allow_coupon_stack BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_auto_promotions BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS discount_kind TEXT NOT NULL DEFAULT 'order_discount' CHECK (discount_kind IN ('order_discount','free_shipping','hybrid')),
  ADD COLUMN IF NOT EXISTS applicable_cities TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS applicable_zip_ranges JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS applicable_region_ids UUID[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS applicable_country_codes TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS applicable_category_ids UUID[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS excluded_product_ids UUID[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS excluded_category_ids UUID[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS applicable_brand_names TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS only_promotional_items BOOLEAN,
  ADD COLUMN IF NOT EXISTS only_non_promotional_items BOOLEAN,
  ADD COLUMN IF NOT EXISTS customer_scope TEXT NOT NULL DEFAULT 'all' CHECK (customer_scope IN ('all','new','specific_customers','customer_groups')),
  ADD COLUMN IF NOT EXISTS allowed_customer_ids UUID[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allowed_customer_group_ids UUID[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS effects JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

CREATE INDEX IF NOT EXISTS idx_coupons_status ON public.coupons(status);
CREATE INDEX IF NOT EXISTS idx_coupons_campaign_tag ON public.coupons(campaign_tag);
CREATE INDEX IF NOT EXISTS idx_coupons_period ON public.coupons(start_at, end_at);

CREATE TABLE IF NOT EXISTS public.coupon_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  coupon_code TEXT NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  applied_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_coupon_usages_coupon_order ON public.coupon_usages(coupon_id, order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coupon_usages_customer ON public.coupon_usages(coupon_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_created_at ON public.coupon_usages(created_at DESC);

ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select coupon_usages by tenant" ON public.coupon_usages;
CREATE POLICY "Select coupon_usages by tenant"
  ON public.coupon_usages FOR SELECT
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Admins manage coupon_usages by tenant" ON public.coupon_usages;
CREATE POLICY "Admins manage coupon_usages by tenant"
  ON public.coupon_usages FOR ALL
  USING (public.is_admin() AND tenant_id = public.current_tenant_id())
  WITH CHECK (public.is_admin() AND tenant_id = public.current_tenant_id());

CREATE OR REPLACE FUNCTION public.refresh_coupon_runtime_status()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.coupons
  SET status = CASE
    WHEN is_active = false THEN 'paused'
    WHEN max_uses IS NOT NULL AND COALESCE(uses_count, 0) >= max_uses THEN 'exhausted'
    WHEN COALESCE(end_at, expiry_date) IS NOT NULL AND COALESCE(end_at, expiry_date) < now() THEN 'expired'
    WHEN start_at IS NOT NULL AND start_at > now() THEN 'draft'
    ELSE 'active'
  END;
$$;

CREATE OR REPLACE FUNCTION public.consume_coupon_usage_atomic(
  p_coupon_id UUID,
  p_order_id UUID,
  p_customer_id UUID,
  p_discount_amount NUMERIC,
  p_applied_rules JSONB DEFAULT '[]'::jsonb,
  p_coupon_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_usage_per_customer INTEGER;
  v_customer_uses INTEGER;
BEGIN
  SELECT tenant_id, usage_per_customer INTO v_tenant_id, v_usage_per_customer
  FROM public.coupons
  WHERE id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.coupons
  SET uses_count = COALESCE(uses_count, 0) + 1,
      updated_at = now()
  WHERE id = p_coupon_id
    AND is_active = TRUE
    AND (max_uses IS NULL OR COALESCE(uses_count, 0) < max_uses);

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_usage_per_customer IS NOT NULL AND p_customer_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_customer_uses
    FROM public.coupon_usages
    WHERE coupon_id = p_coupon_id AND customer_id = p_customer_id;

    IF v_customer_uses >= v_usage_per_customer THEN
      UPDATE public.coupons SET uses_count = GREATEST(COALESCE(uses_count, 1) - 1, 0) WHERE id = p_coupon_id;
      RETURN FALSE;
    END IF;
  END IF;

  INSERT INTO public.coupon_usages (
    tenant_id, coupon_id, order_id, customer_id, coupon_code, discount_amount, applied_rules
  ) VALUES (
    COALESCE(v_tenant_id, '00000000-0000-0000-0000-000000000001'::uuid),
    p_coupon_id,
    p_order_id,
    p_customer_id,
    COALESCE(p_coupon_code, ''),
    COALESCE(p_discount_amount, 0),
    COALESCE(p_applied_rules, '[]'::jsonb)
  ) ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$;
