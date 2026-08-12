-- 1. Lock down permissive INSERT policies (WITH CHECK true) ------------------

DROP POLICY IF EXISTS "Service can insert handshake logs" ON public.appmax_handshake_logs;
CREATE POLICY "Service or admins can insert handshake logs"
ON public.appmax_handshake_logs
FOR INSERT
WITH CHECK (
  ((auth.jwt() ->> 'role') = 'service_role')
  OR public.is_admin()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Service can insert appmax_settings" ON public.appmax_settings;
CREATE POLICY "Service or admins can insert appmax_settings"
ON public.appmax_settings
FOR INSERT
WITH CHECK (
  ((auth.jwt() ->> 'role') = 'service_role')
  OR public.is_admin()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Service can insert sync runs" ON public.bling_sync_runs;
CREATE POLICY "Service or admins can insert sync runs"
ON public.bling_sync_runs
FOR INSERT
WITH CHECK (
  ((auth.jwt() ->> 'role') = 'service_role')
  OR public.is_admin()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Service can insert test logs" ON public.integrations_checkout_test_logs;
CREATE POLICY "Service or admins can insert test logs"
ON public.integrations_checkout_test_logs
FOR INSERT
WITH CHECK (
  ((auth.jwt() ->> 'role') = 'service_role')
  OR public.is_admin()
  OR public.is_super_admin()
);

-- 2. Orders: whitelist which columns a customer may change -------------------
-- RLS cannot restrict columns, so enforcement lives in this trigger.
-- Non-admin callers may ONLY change shipping contact fields and notes.

CREATE OR REPLACE FUNCTION public.prevent_sensitive_order_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Admins, super admins, service role and backend jobs keep full access.
  IF auth.uid() IS NULL
     OR (auth.jwt() ->> 'role') = 'service_role'
     OR is_admin()
     OR is_super_admin()
  THEN
    RETURN NEW;
  END IF;

  -- Whitelist: everything not listed here must remain byte-identical.
  IF NEW.id                   IS DISTINCT FROM OLD.id
     OR NEW.order_number      IS DISTINCT FROM OLD.order_number
     OR NEW.customer_id       IS DISTINCT FROM OLD.customer_id
     OR NEW.user_id           IS DISTINCT FROM OLD.user_id
     OR NEW.tenant_id         IS DISTINCT FROM OLD.tenant_id
     OR NEW.subtotal          IS DISTINCT FROM OLD.subtotal
     OR NEW.shipping_cost     IS DISTINCT FROM OLD.shipping_cost
     OR NEW.discount_amount   IS DISTINCT FROM OLD.discount_amount
     OR NEW.total_amount      IS DISTINCT FROM OLD.total_amount
     OR NEW.status            IS DISTINCT FROM OLD.status
     OR NEW.payment_status    IS DISTINCT FROM OLD.payment_status
     OR NEW.payment_method    IS DISTINCT FROM OLD.payment_method
     OR NEW.installments      IS DISTINCT FROM OLD.installments
     OR NEW.tracking_code     IS DISTINCT FROM OLD.tracking_code
     OR NEW.coupon_code       IS DISTINCT FROM OLD.coupon_code
     OR NEW.shipping_method   IS DISTINCT FROM OLD.shipping_method
     OR NEW.customer_email    IS DISTINCT FROM OLD.customer_email
     OR NEW.customer_cpf      IS DISTINCT FROM OLD.customer_cpf
     OR NEW.access_token      IS DISTINCT FROM OLD.access_token
     OR NEW.idempotency_key   IS DISTINCT FROM OLD.idempotency_key
     OR NEW.provider          IS DISTINCT FROM OLD.provider
     OR NEW.gateway           IS DISTINCT FROM OLD.gateway
     OR NEW.transaction_id    IS DISTINCT FROM OLD.transaction_id
     OR NEW.external_reference IS DISTINCT FROM OLD.external_reference
     OR NEW.stripe_charge_id  IS DISTINCT FROM OLD.stripe_charge_id
     OR NEW.checkout_session_id IS DISTINCT FROM OLD.checkout_session_id
     OR NEW.cart_id           IS DISTINCT FROM OLD.cart_id
     OR NEW.appmax_customer_id IS DISTINCT FROM OLD.appmax_customer_id
     OR NEW.appmax_order_id   IS DISTINCT FROM OLD.appmax_order_id
     OR NEW.bling_order_id    IS DISTINCT FROM OLD.bling_order_id
     OR NEW.yampi_order_number IS DISTINCT FROM OLD.yampi_order_number
     OR NEW.yampi_created_at  IS DISTINCT FROM OLD.yampi_created_at
     OR NEW.last_webhook_event IS DISTINCT FROM OLD.last_webhook_event
     OR NEW.created_at        IS DISTINCT FROM OLD.created_at
     OR NEW.utm_source        IS DISTINCT FROM OLD.utm_source
     OR NEW.utm_medium        IS DISTINCT FROM OLD.utm_medium
     OR NEW.utm_campaign      IS DISTINCT FROM OLD.utm_campaign
     OR NEW.utm_term          IS DISTINCT FROM OLD.utm_term
     OR NEW.utm_content       IS DISTINCT FROM OLD.utm_content
     OR NEW.referrer          IS DISTINCT FROM OLD.referrer
     OR NEW.landing_page      IS DISTINCT FROM OLD.landing_page
  THEN
    RAISE EXCEPTION 'Only shipping details and notes can be modified on your own order';
  END IF;

  RETURN NEW;
END;
$function$;

-- Remove the duplicated trigger so the check runs exactly once.
DROP TRIGGER IF EXISTS prevent_sensitive_order_updates_trg ON public.orders;