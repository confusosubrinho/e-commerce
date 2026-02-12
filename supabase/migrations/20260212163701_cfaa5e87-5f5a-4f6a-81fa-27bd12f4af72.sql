
-- Pricing Engine: centralized config table
CREATE TABLE public.payment_pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  max_installments integer NOT NULL DEFAULT 12,
  interest_free_installments integer NOT NULL DEFAULT 3,
  card_cash_rate numeric NOT NULL DEFAULT 0,
  pix_discount numeric NOT NULL DEFAULT 5,
  cash_discount numeric NOT NULL DEFAULT 5,
  interest_mode text NOT NULL DEFAULT 'fixed' CHECK (interest_mode IN ('fixed', 'by_installment')),
  monthly_rate_fixed numeric DEFAULT 0,
  monthly_rate_by_installment jsonb DEFAULT '{}',
  min_installment_value numeric NOT NULL DEFAULT 25,
  rounding_mode text NOT NULL DEFAULT 'adjust_last' CHECK (rounding_mode IN ('adjust_last', 'truncate')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.payment_pricing_config ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view active pricing config"
  ON public.payment_pricing_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage pricing config"
  ON public.payment_pricing_config FOR ALL
  USING (is_admin());

-- Audit log
CREATE TABLE public.payment_pricing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES public.payment_pricing_config(id),
  before_data jsonb,
  after_data jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_pricing_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.payment_pricing_audit_log FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert audit log"
  ON public.payment_pricing_audit_log FOR INSERT
  WITH CHECK (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_payment_pricing_config_updated_at
  BEFORE UPDATE ON public.payment_pricing_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default config from current store_settings
INSERT INTO public.payment_pricing_config (
  is_active,
  max_installments,
  interest_free_installments,
  card_cash_rate,
  pix_discount,
  cash_discount,
  interest_mode,
  monthly_rate_fixed,
  min_installment_value
)
SELECT
  true,
  COALESCE(s.max_installments, 6),
  COALESCE(s.installments_without_interest, 3),
  0,
  COALESCE(s.pix_discount, 5),
  COALESCE(s.cash_discount, 5),
  'fixed',
  COALESCE(s.installment_interest_rate, 0),
  COALESCE(s.min_installment_value, 30)
FROM public.store_settings s
LIMIT 1;
