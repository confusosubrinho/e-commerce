BEGIN;
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.tenants(id),
  email text NOT NULL CHECK (length(email) <= 320 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  source text NOT NULL DEFAULT 'website' CHECK (source = 'website'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX newsletter_subscribers_email_tenant ON public.newsletter_subscribers(tenant_id, lower(email));
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.tenants(id),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  email text NOT NULL CHECK (length(email) <= 320 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  phone text CHECK (length(phone) <= 100),
  subject text NOT NULL CHECK (length(trim(subject)) BETWEEN 1 AND 300),
  message text NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.newsletter_subscribers, public.contact_messages FROM anon, authenticated;
GRANT INSERT ON public.newsletter_subscribers, public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.newsletter_subscribers, public.contact_messages TO authenticated;
GRANT ALL ON public.newsletter_subscribers, public.contact_messages TO service_role;
CREATE POLICY newsletter_submit ON public.newsletter_subscribers FOR INSERT TO anon, authenticated WITH CHECK (tenant_id=public.get_current_tenant_id());
CREATE POLICY contact_submit ON public.contact_messages FOR INSERT TO anon, authenticated WITH CHECK (tenant_id=public.get_current_tenant_id());
CREATE POLICY newsletter_admin ON public.newsletter_subscribers FOR ALL TO authenticated USING (public.is_admin() AND (tenant_id=public.get_current_tenant_id() OR public.is_super_admin())) WITH CHECK (public.is_admin() AND (tenant_id=public.get_current_tenant_id() OR public.is_super_admin()));
CREATE POLICY contact_admin ON public.contact_messages FOR ALL TO authenticated USING (public.is_admin() AND (tenant_id=public.get_current_tenant_id() OR public.is_super_admin())) WITH CHECK (public.is_admin() AND (tenant_id=public.get_current_tenant_id() OR public.is_super_admin()));
COMMIT;
