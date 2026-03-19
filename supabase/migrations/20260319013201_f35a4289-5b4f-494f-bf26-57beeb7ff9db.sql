
-- Fix: Add tenant_id to product_change_log and product_reviews (they don't have it yet)

-- product_change_log
ALTER TABLE public.product_change_log ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.product_change_log SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.product_change_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.product_change_log ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN
  ALTER TABLE public.product_change_log ADD CONSTRAINT product_change_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_product_change_log_tenant_id ON public.product_change_log(tenant_id);

-- product_reviews
ALTER TABLE public.product_reviews ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.product_reviews SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.product_reviews ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.product_reviews ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN
  ALTER TABLE public.product_reviews ADD CONSTRAINT product_reviews_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_product_reviews_tenant_id ON public.product_reviews(tenant_id);

-- admin_members
ALTER TABLE public.admin_members ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.admin_members SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.admin_members ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.admin_members ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN
  ALTER TABLE public.admin_members ADD CONSTRAINT admin_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_admin_members_tenant_id ON public.admin_members(tenant_id);
