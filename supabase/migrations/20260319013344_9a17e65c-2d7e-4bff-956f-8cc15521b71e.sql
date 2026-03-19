
-- Batch 1: Add tenant_id to tables (A-C)
-- abandoned_carts
ALTER TABLE public.abandoned_carts ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.abandoned_carts SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.abandoned_carts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.abandoned_carts ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.abandoned_carts ADD CONSTRAINT abandoned_carts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_tenant_id ON public.abandoned_carts(tenant_id);

-- admin_audit_log
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.admin_audit_log SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.admin_audit_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.admin_audit_log ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_tenant_id ON public.admin_audit_log(tenant_id);

-- admin_notifications
ALTER TABLE public.admin_notifications ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.admin_notifications SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.admin_notifications ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.admin_notifications ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_tenant_id ON public.admin_notifications(tenant_id);

-- announcement_bar
ALTER TABLE public.announcement_bar ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.announcement_bar SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.announcement_bar ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.announcement_bar ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.announcement_bar ADD CONSTRAINT announcement_bar_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_announcement_bar_tenant_id ON public.announcement_bar(tenant_id);

-- app_logs (nullable - system logs)
ALTER TABLE public.app_logs ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.app_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.app_logs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.app_logs ADD CONSTRAINT app_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_app_logs_tenant_id ON public.app_logs(tenant_id);

-- appmax_handshake_logs
ALTER TABLE public.appmax_handshake_logs ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.appmax_handshake_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.appmax_handshake_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.appmax_handshake_logs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.appmax_handshake_logs ADD CONSTRAINT appmax_handshake_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_appmax_handshake_logs_tenant_id ON public.appmax_handshake_logs(tenant_id);

-- appmax_installations
ALTER TABLE public.appmax_installations ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.appmax_installations SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.appmax_installations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.appmax_installations ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.appmax_installations ADD CONSTRAINT appmax_installations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_appmax_installations_tenant_id ON public.appmax_installations(tenant_id);

-- appmax_logs (nullable)
ALTER TABLE public.appmax_logs ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.appmax_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.appmax_logs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.appmax_logs ADD CONSTRAINT appmax_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_appmax_logs_tenant_id ON public.appmax_logs(tenant_id);

-- appmax_settings
ALTER TABLE public.appmax_settings ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.appmax_settings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.appmax_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.appmax_settings ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.appmax_settings ADD CONSTRAINT appmax_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_appmax_settings_tenant_id ON public.appmax_settings(tenant_id);

-- appmax_tokens_cache
ALTER TABLE public.appmax_tokens_cache ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.appmax_tokens_cache SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.appmax_tokens_cache ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.appmax_tokens_cache ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.appmax_tokens_cache ADD CONSTRAINT appmax_tokens_cache_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_appmax_tokens_cache_tenant_id ON public.appmax_tokens_cache(tenant_id);

-- bling_sync_config
ALTER TABLE public.bling_sync_config ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.bling_sync_config SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.bling_sync_config ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.bling_sync_config ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.bling_sync_config ADD CONSTRAINT bling_sync_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_bling_sync_config_tenant_id ON public.bling_sync_config(tenant_id);

-- bling_sync_runs (nullable)
ALTER TABLE public.bling_sync_runs ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.bling_sync_runs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.bling_sync_runs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.bling_sync_runs ADD CONSTRAINT bling_sync_runs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_bling_sync_runs_tenant_id ON public.bling_sync_runs(tenant_id);

-- bling_webhook_events (nullable)
ALTER TABLE public.bling_webhook_events ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.bling_webhook_events SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.bling_webhook_events ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.bling_webhook_events ADD CONSTRAINT bling_webhook_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_bling_webhook_events_tenant_id ON public.bling_webhook_events(tenant_id);

-- bling_webhook_logs (nullable)
ALTER TABLE public.bling_webhook_logs ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.bling_webhook_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.bling_webhook_logs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.bling_webhook_logs ADD CONSTRAINT bling_webhook_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_bling_webhook_logs_tenant_id ON public.bling_webhook_logs(tenant_id);

-- blog_posts
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.blog_posts SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.blog_posts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.blog_posts ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_blog_posts_tenant_id ON public.blog_posts(tenant_id);

-- blog_settings
ALTER TABLE public.blog_settings ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.blog_settings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.blog_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.blog_settings ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.blog_settings ADD CONSTRAINT blog_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_blog_settings_tenant_id ON public.blog_settings(tenant_id);

-- buy_together_products
ALTER TABLE public.buy_together_products ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.buy_together_products SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.buy_together_products ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.buy_together_products ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.buy_together_products ADD CONSTRAINT buy_together_products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_buy_together_products_tenant_id ON public.buy_together_products(tenant_id);

-- catalog_sync_queue (nullable)
ALTER TABLE public.catalog_sync_queue ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.catalog_sync_queue SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.catalog_sync_queue ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.catalog_sync_queue ADD CONSTRAINT catalog_sync_queue_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_catalog_sync_queue_tenant_id ON public.catalog_sync_queue(tenant_id);

-- catalog_sync_runs (nullable)
ALTER TABLE public.catalog_sync_runs ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.catalog_sync_runs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.catalog_sync_runs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.catalog_sync_runs ADD CONSTRAINT catalog_sync_runs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_catalog_sync_runs_tenant_id ON public.catalog_sync_runs(tenant_id);

-- checkout_settings
ALTER TABLE public.checkout_settings ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.checkout_settings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.checkout_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.checkout_settings ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.checkout_settings ADD CONSTRAINT checkout_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_checkout_settings_tenant_id ON public.checkout_settings(tenant_id);

-- cleanup_runs (nullable)
ALTER TABLE public.cleanup_runs ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.cleanup_runs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.cleanup_runs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.cleanup_runs ADD CONSTRAINT cleanup_runs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_cleanup_runs_tenant_id ON public.cleanup_runs(tenant_id);

-- contact_messages
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.contact_messages SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.contact_messages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.contact_messages ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.contact_messages ADD CONSTRAINT contact_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_contact_messages_tenant_id ON public.contact_messages(tenant_id);
