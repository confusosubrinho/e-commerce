BEGIN;
-- Rollback sem perder contatos: revogar EXECUTE de submit_restock_request para anon
-- e authenticated e retirar a UI. Manter a tabela privada para consulta/exportação
-- administrativa; só remover dados após backup e autorização do proprietário.

CREATE TABLE public.restock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.get_current_tenant_id() REFERENCES public.tenants(id),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  email text NOT NULL CHECK (length(email) <= 320 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  whatsapp text NOT NULL CHECK (whatsapp ~ '^55[1-9][0-9]{9,10}$'),
  product_id text NOT NULL CHECK (product_id ~ '^gid://shopify/Product/[0-9]+$'),
  variant_id text NOT NULL CHECK (variant_id ~ '^gid://shopify/ProductVariant/[0-9]+$'),
  product_handle text NOT NULL CHECK (length(product_handle) BETWEEN 1 AND 200 AND product_handle ~ '^[a-z0-9][a-z0-9-]*$'),
  product_title text NOT NULL CHECK (length(trim(product_title)) BETWEEN 1 AND 300),
  variant_title text NOT NULL CHECK (length(trim(variant_title)) BETWEEN 1 AND 300),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  consent_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  notified_via text CHECK (notified_via IN ('whatsapp', 'email', 'other')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000)
);
CREATE UNIQUE INDEX restock_waiting_email_variant ON public.restock_requests (tenant_id, variant_id, lower(email)) WHERE status = 'waiting';
CREATE INDEX restock_requests_queue ON public.restock_requests (tenant_id, status, created_at DESC);
CREATE INDEX restock_requests_email_created ON public.restock_requests (tenant_id, lower(email), created_at);
ALTER TABLE public.restock_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restock_requests FROM anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.restock_requests TO authenticated;
GRANT ALL ON public.restock_requests TO service_role;

CREATE POLICY restock_admin ON public.restock_requests FOR ALL TO authenticated
USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin()))
WITH CHECK (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin()));

-- Public submission returns no personal information or row IDs. No direct anon table access.
CREATE FUNCTION public.submit_restock_request(p_data jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := public.get_current_tenant_id();
  v_email text := lower(trim(p_data->>'email'));
  v_phone text := regexp_replace(coalesce(p_data->>'whatsapp', ''), '[^0-9]', '', 'g');
BEGIN
  IF coalesce(p_data->>'website', '') <> '' THEN RETURN; END IF;
  IF p_data->>'consent' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Confirme que deseja receber o aviso de reposição.' USING ERRCODE = '22023';
  END IF;
  IF length(v_phone) IN (10, 11) THEN v_phone := '55' || v_phone; END IF;
  -- Serializes the per-email limit and duplicate submissions.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_tenant::text || coalesce(v_email, ''), 0));
  IF EXISTS (SELECT 1 FROM public.restock_requests WHERE tenant_id = v_tenant AND lower(email) = v_email
    AND variant_id = p_data->>'variant_id' AND status = 'waiting') THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.restock_requests WHERE tenant_id = v_tenant AND lower(email) = v_email
    AND created_at >= now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'Limite de solicitações atingido. Tente novamente amanhã.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.restock_requests (tenant_id, name, email, whatsapp, product_id, variant_id, product_handle, product_title, variant_title)
  VALUES (v_tenant, trim(p_data->>'name'), v_email, v_phone, p_data->>'product_id', p_data->>'variant_id',
    p_data->>'product_handle', trim(p_data->>'product_title'), trim(p_data->>'variant_title'));
END;
$$;
REVOKE ALL ON FUNCTION public.submit_restock_request(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_restock_request(jsonb) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
