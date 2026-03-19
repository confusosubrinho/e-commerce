
-- Batch 3: Add tenant_id to tables (O-Z)

-- order_events (nullable)
ALTER TABLE public.order_events ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.order_events SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.order_events ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.order_events ADD CONSTRAINT order_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_order_events_tenant_id ON public.order_events(tenant_id);

-- page_contents
ALTER TABLE public.page_contents ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.page_contents SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.page_contents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.page_contents ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.page_contents ADD CONSTRAINT page_contents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_page_contents_tenant_id ON public.page_contents(tenant_id);

-- payment_methods_display
ALTER TABLE public.payment_methods_display ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.payment_methods_display SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.payment_methods_display ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.payment_methods_display ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.payment_methods_display ADD CONSTRAINT payment_methods_display_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_payment_methods_display_tenant_id ON public.payment_methods_display(tenant_id);

-- payment_pricing_audit_log (nullable)
ALTER TABLE public.payment_pricing_audit_log ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.payment_pricing_audit_log SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.payment_pricing_audit_log ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.payment_pricing_audit_log ADD CONSTRAINT payment_pricing_audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_payment_pricing_audit_log_tenant_id ON public.payment_pricing_audit_log(tenant_id);

-- payment_pricing_config
ALTER TABLE public.payment_pricing_config ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.payment_pricing_config SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.payment_pricing_config ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.payment_pricing_config ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.payment_pricing_config ADD CONSTRAINT payment_pricing_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_payment_pricing_config_tenant_id ON public.payment_pricing_config(tenant_id);

-- product_characteristics
ALTER TABLE public.product_characteristics ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.product_characteristics SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.product_characteristics ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.product_characteristics ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.product_characteristics ADD CONSTRAINT product_characteristics_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_product_characteristics_tenant_id ON public.product_characteristics(tenant_id);

-- security_seals
ALTER TABLE public.security_seals ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.security_seals SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.security_seals ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.security_seals ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.security_seals ADD CONSTRAINT security_seals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_security_seals_tenant_id ON public.security_seals(tenant_id);

-- site_theme
ALTER TABLE public.site_theme ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.site_theme SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.site_theme ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.site_theme ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.site_theme ADD CONSTRAINT site_theme_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_site_theme_tenant_id ON public.site_theme(tenant_id);

-- social_links
ALTER TABLE public.social_links ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.social_links SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.social_links ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.social_links ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.social_links ADD CONSTRAINT social_links_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_social_links_tenant_id ON public.social_links(tenant_id);

-- stock_notifications
ALTER TABLE public.stock_notifications ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.stock_notifications SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.stock_notifications ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.stock_notifications ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.stock_notifications ADD CONSTRAINT stock_notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_stock_notifications_tenant_id ON public.stock_notifications(tenant_id);

-- store_setup
ALTER TABLE public.store_setup ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.store_setup SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.store_setup ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.store_setup ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.store_setup ADD CONSTRAINT store_setup_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_store_setup_tenant_id ON public.store_setup(tenant_id);

-- stripe_webhook_events (nullable)
ALTER TABLE public.stripe_webhook_events ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.stripe_webhook_events SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.stripe_webhook_events ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.stripe_webhook_events ADD CONSTRAINT stripe_webhook_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_tenant_id ON public.stripe_webhook_events(tenant_id);

-- traffic_sessions (nullable)
ALTER TABLE public.traffic_sessions ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.traffic_sessions SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.traffic_sessions ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.traffic_sessions ADD CONSTRAINT traffic_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_traffic_sessions_tenant_id ON public.traffic_sessions(tenant_id);

-- variation_value_map
ALTER TABLE public.variation_value_map ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.variation_value_map SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.variation_value_map ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.variation_value_map ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.variation_value_map ADD CONSTRAINT variation_value_map_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_variation_value_map_tenant_id ON public.variation_value_map(tenant_id);
