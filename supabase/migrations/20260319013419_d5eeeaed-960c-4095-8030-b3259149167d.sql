
-- Batch 2: Add tenant_id to tables (E-N)

-- email_automations
ALTER TABLE public.email_automations ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.email_automations SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.email_automations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.email_automations ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.email_automations ADD CONSTRAINT email_automations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_email_automations_tenant_id ON public.email_automations(tenant_id);

-- email_automation_logs (nullable)
ALTER TABLE public.email_automation_logs ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.email_automation_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.email_automation_logs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.email_automation_logs ADD CONSTRAINT email_automation_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_email_automation_logs_tenant_id ON public.email_automation_logs(tenant_id);

-- error_logs (nullable)
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.error_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.error_logs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.error_logs ADD CONSTRAINT error_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_error_logs_tenant_id ON public.error_logs(tenant_id);

-- favorites
ALTER TABLE public.favorites ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.favorites SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.favorites ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.favorites ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.favorites ADD CONSTRAINT favorites_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_favorites_tenant_id ON public.favorites(tenant_id);

-- features_bar
ALTER TABLE public.features_bar ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.features_bar SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.features_bar ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.features_bar ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.features_bar ADD CONSTRAINT features_bar_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_features_bar_tenant_id ON public.features_bar(tenant_id);

-- help_articles (nullable)
ALTER TABLE public.help_articles ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.help_articles SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.help_articles ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.help_articles ADD CONSTRAINT help_articles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_help_articles_tenant_id ON public.help_articles(tenant_id);

-- highlight_banners
ALTER TABLE public.highlight_banners ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.highlight_banners SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.highlight_banners ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.highlight_banners ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.highlight_banners ADD CONSTRAINT highlight_banners_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_highlight_banners_tenant_id ON public.highlight_banners(tenant_id);

-- home_page_sections
ALTER TABLE public.home_page_sections ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.home_page_sections SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.home_page_sections ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.home_page_sections ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.home_page_sections ADD CONSTRAINT home_page_sections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_home_page_sections_tenant_id ON public.home_page_sections(tenant_id);

-- home_sections
ALTER TABLE public.home_sections ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.home_sections SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.home_sections ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.home_sections ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.home_sections ADD CONSTRAINT home_sections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_home_sections_tenant_id ON public.home_sections(tenant_id);

-- homepage_testimonials
ALTER TABLE public.homepage_testimonials ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.homepage_testimonials SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.homepage_testimonials ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.homepage_testimonials ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.homepage_testimonials ADD CONSTRAINT homepage_testimonials_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_homepage_testimonials_tenant_id ON public.homepage_testimonials(tenant_id);

-- homepage_testimonials_config
ALTER TABLE public.homepage_testimonials_config ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.homepage_testimonials_config SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.homepage_testimonials_config ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.homepage_testimonials_config ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.homepage_testimonials_config ADD CONSTRAINT homepage_testimonials_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_homepage_testimonials_config_tenant_id ON public.homepage_testimonials_config(tenant_id);

-- instagram_videos
ALTER TABLE public.instagram_videos ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.instagram_videos SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.instagram_videos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.instagram_videos ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.instagram_videos ADD CONSTRAINT instagram_videos_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_instagram_videos_tenant_id ON public.instagram_videos(tenant_id);

-- integrations_checkout_test_logs (nullable)
ALTER TABLE public.integrations_checkout_test_logs ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.integrations_checkout_test_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.integrations_checkout_test_logs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.integrations_checkout_test_logs ADD CONSTRAINT integrations_checkout_test_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_integrations_checkout_test_logs_tenant_id ON public.integrations_checkout_test_logs(tenant_id);

-- log_daily_stats (nullable)
ALTER TABLE public.log_daily_stats ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.log_daily_stats SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.log_daily_stats ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.log_daily_stats ADD CONSTRAINT log_daily_stats_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_log_daily_stats_tenant_id ON public.log_daily_stats(tenant_id);

-- login_attempts (nullable)
ALTER TABLE public.login_attempts ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.login_attempts SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.login_attempts ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.login_attempts ADD CONSTRAINT login_attempts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_login_attempts_tenant_id ON public.login_attempts(tenant_id);

-- newsletter_subscribers
ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.newsletter_subscribers SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.newsletter_subscribers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.newsletter_subscribers ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
DO $$ BEGIN ALTER TABLE public.newsletter_subscribers ADD CONSTRAINT newsletter_subscribers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_tenant_id ON public.newsletter_subscribers(tenant_id);
