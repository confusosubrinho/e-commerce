BEGIN;

SET LOCAL search_path TO public, extensions;

-- Selective baseline; no retired commerce tables or credentials.

CREATE TYPE public."app_role" AS ENUM ('admin', 'user');

CREATE TABLE public."admin_audit_log" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid,
"user_email" text,
"action" text NOT NULL,
"resource_type" text NOT NULL,
"resource_id" text,
"resource_name" text,
"old_values" jsonb,
"new_values" jsonb,
"ip_address" text,
"user_agent" text,
"created_at" timestamp with time zone DEFAULT now(),
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."admin_members" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid,
"email" text NOT NULL,
"full_name" text,
"role" text DEFAULT 'operator'::text NOT NULL,
"is_active" boolean DEFAULT true,
"invited_by" uuid,
"invited_at" timestamp with time zone DEFAULT now(),
"last_access" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now(),
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."announcement_bar" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"is_active" boolean DEFAULT false,
"messages" jsonb DEFAULT '[{"link": null, "text": "Frete grátis acima de R$ 299"}]'::jsonb,
"bg_color" text DEFAULT '#1a1a2e'::text,
"text_color" text DEFAULT '#ffffff'::text,
"font_size" text DEFAULT 'sm'::text,
"autoplay" boolean DEFAULT true,
"autoplay_speed" integer DEFAULT 4,
"closeable" boolean DEFAULT true,
"updated_at" timestamp with time zone DEFAULT now(),
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."banners" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"title" text,
"subtitle" text,
"image_url" text NOT NULL,
"cta_text" text,
"cta_url" text,
"display_order" integer DEFAULT 0,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"mobile_image_url" text,
"show_on_desktop" boolean DEFAULT true NOT NULL,
"show_on_mobile" boolean DEFAULT true NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."blog_posts" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"title" text NOT NULL,
"slug" text NOT NULL,
"excerpt" text,
"content" text,
"featured_image_url" text,
"status" text DEFAULT 'draft'::text NOT NULL,
"published_at" timestamp with time zone,
"seo_title" text,
"seo_description" text,
"author_name" text,
"category_tag" text,
"tags" text[] DEFAULT '{}'::text[],
"display_order" integer DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."blog_settings" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"is_active" boolean DEFAULT false NOT NULL,
"posts_per_page" integer DEFAULT 12 NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."categories" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"slug" text NOT NULL,
"description" text,
"image_url" text,
"display_order" integer DEFAULT 0,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"seo_title" text,
"seo_description" text,
"seo_keywords" text,
"parent_category_id" uuid,
"banner_image_url" text,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."cleanup_runs" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"job_type" text NOT NULL,
"mode" text DEFAULT 'execute'::text NOT NULL,
"started_at" timestamp with time zone DEFAULT now() NOT NULL,
"finished_at" timestamp with time zone,
"duration_ms" integer,
"records_deleted" integer DEFAULT 0,
"records_consolidated" integer DEFAULT 0,
"bytes_freed" bigint DEFAULT 0,
"details" jsonb DEFAULT '{}'::jsonb,
"errors" text[],
"status" text DEFAULT 'running'::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
);

CREATE TABLE public."features_bar" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"title" text NOT NULL,
"subtitle" text,
"icon_url" text,
"display_order" integer DEFAULT 0,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."help_articles" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"key" text NOT NULL,
"title" text NOT NULL,
"content" text DEFAULT ''::text NOT NULL,
"audience" text DEFAULT 'both'::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
);

CREATE TABLE public."highlight_banners" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"image_url" text NOT NULL,
"link_url" text,
"title" text,
"display_order" integer DEFAULT 0,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."home_page_sections" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"section_key" text NOT NULL,
"section_type" text NOT NULL,
"label" text NOT NULL,
"is_active" boolean DEFAULT true NOT NULL,
"display_order" integer DEFAULT 0 NOT NULL,
"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"icon" text DEFAULT 'Layout'::text NOT NULL,
"is_native" boolean DEFAULT true,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."home_sections" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"title" text NOT NULL,
"subtitle" text,
"section_type" text DEFAULT 'carousel'::text NOT NULL,
"source_type" text DEFAULT 'category'::text NOT NULL,
"category_id" uuid,
"product_ids" uuid[] DEFAULT '{}'::uuid[],
"max_items" integer DEFAULT 10,
"display_order" integer DEFAULT 0,
"is_active" boolean DEFAULT true,
"show_view_all" boolean DEFAULT true,
"view_all_link" text,
"dark_bg" boolean DEFAULT false,
"card_bg" boolean DEFAULT false,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"sort_order" text DEFAULT 'newest'::text,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
"shopify_collection_handle" text,
"shopify_product_handles" text[] DEFAULT '{}'::text[]
);

CREATE TABLE public."homepage_testimonials" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"customer_name" text NOT NULL,
"rating" integer DEFAULT 5 NOT NULL,
"testimonial" text NOT NULL,
"display_order" integer DEFAULT 0 NOT NULL,
"is_active" boolean DEFAULT true NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"photo_url" text,
"product_id" uuid,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."homepage_testimonials_config" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"is_active" boolean DEFAULT true NOT NULL,
"title" text DEFAULT 'O que dizem sobre nós'::text NOT NULL,
"subtitle" text DEFAULT 'Confira alguns depoimentos reais'::text NOT NULL,
"bg_color" text DEFAULT '#f5f0eb'::text NOT NULL,
"card_color" text DEFAULT '#ffffff'::text NOT NULL,
"star_color" text DEFAULT '#f5a623'::text NOT NULL,
"text_color" text DEFAULT '#333333'::text NOT NULL,
"cards_per_view" integer DEFAULT 4 NOT NULL,
"autoplay" boolean DEFAULT true NOT NULL,
"autoplay_speed" integer DEFAULT 5 NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
"show_google_summary" boolean DEFAULT false NOT NULL,
"google_rating" numeric(2,1),
"google_reviews_count" integer,
"google_profile_url" text
);

CREATE TABLE public."instagram_videos" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"video_url" text NOT NULL,
"thumbnail_url" text,
"username" text,
"product_id" uuid,
"display_order" integer DEFAULT 0,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."log_daily_stats" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"stat_date" date NOT NULL,
"log_source" text NOT NULL,
"total_count" integer DEFAULT 0,
"error_count" integer DEFAULT 0,
"warning_count" integer DEFAULT 0,
"info_count" integer DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
);

CREATE TABLE public."login_attempts" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"email" text NOT NULL,
"ip_hash" text,
"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
"success" boolean DEFAULT false,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
);

CREATE TABLE public."page_contents" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"page_slug" text NOT NULL,
"page_title" text NOT NULL,
"content" text,
"meta_description" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."payment_methods_display" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"image_url" text,
"link_url" text,
"display_order" integer DEFAULT 0,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."payment_pricing_audit_log" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"config_id" uuid,
"before_data" jsonb,
"after_data" jsonb,
"changed_by" uuid,
"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
);

CREATE TABLE public."payment_pricing_config" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"is_active" boolean DEFAULT true NOT NULL,
"max_installments" integer DEFAULT 12 NOT NULL,
"interest_free_installments" integer DEFAULT 3 NOT NULL,
"card_cash_rate" numeric DEFAULT 0 NOT NULL,
"pix_discount" numeric DEFAULT 5 NOT NULL,
"cash_discount" numeric DEFAULT 5 NOT NULL,
"interest_mode" text DEFAULT 'fixed'::text NOT NULL,
"monthly_rate_fixed" numeric DEFAULT 0,
"monthly_rate_by_installment" jsonb DEFAULT '{}'::jsonb,
"min_installment_value" numeric DEFAULT 25 NOT NULL,
"rounding_mode" text DEFAULT 'adjust_last'::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_by" uuid,
"transparent_checkout_fee_percent" numeric DEFAULT 0 NOT NULL,
"transparent_checkout_fee_enabled" boolean DEFAULT false NOT NULL,
"gateway_fee_1x_percent" numeric DEFAULT 4.99 NOT NULL,
"gateway_fee_additional_per_installment_percent" numeric DEFAULT 2.49 NOT NULL,
"gateway_fee_starts_at_installment" integer DEFAULT 2 NOT NULL,
"gateway_fee_mode" text DEFAULT 'linear_per_installment'::text NOT NULL,
"pix_discount_applies_to_sale_products" boolean DEFAULT true NOT NULL,
"interest_free_installments_sale" integer,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."profiles" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"full_name" text,
"phone" text,
"address" text,
"city" text,
"state" text,
"zip_code" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."security_seals" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"title" text,
"image_url" text,
"html_code" text,
"link_url" text,
"display_order" integer DEFAULT 0,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."site_theme" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"primary_color" text DEFAULT '#33cc99'::text NOT NULL,
"primary_color_dark" text DEFAULT '#2ba882'::text NOT NULL,
"primary_color_light" text DEFAULT '#e6f9f2'::text NOT NULL,
"accent_color" text DEFAULT '#1a1a1a'::text NOT NULL,
"background_color" text DEFAULT '#ffffff'::text NOT NULL,
"text_color" text DEFAULT '#1a1a1a'::text NOT NULL,
"font_family" text DEFAULT 'Maven Pro'::text NOT NULL,
"font_heading" text DEFAULT 'Maven Pro'::text NOT NULL,
"border_radius" text DEFAULT 'medium'::text NOT NULL,
"shadow_intensity" text DEFAULT 'medium'::text NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."social_links" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"url" text NOT NULL,
"icon_type" text DEFAULT 'default'::text NOT NULL,
"icon_image_url" text,
"sort_order" integer DEFAULT 0 NOT NULL,
"is_active" boolean DEFAULT true NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."store_settings" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"store_name" text DEFAULT 'Vanessa Lima Shoes'::text,
"logo_url" text,
"contact_email" text,
"contact_phone" text,
"contact_whatsapp" text,
"address" text,
"instagram_url" text,
"facebook_url" text,
"free_shipping_threshold" numeric(10,2) DEFAULT 399,
"max_installments" integer DEFAULT 6,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"head_code" text,
"body_code" text,
"google_analytics_id" text,
"facebook_pixel_id" text,
"tiktok_pixel_id" text,
"pix_discount" numeric DEFAULT 5,
"cash_discount" numeric DEFAULT 5,
"installment_interest_rate" numeric DEFAULT 0,
"min_installment_value" numeric DEFAULT 30,
"installments_without_interest" integer DEFAULT 3,
"cnpj" text,
"full_address" text,
"shipping_store_pickup_enabled" boolean DEFAULT false,
"shipping_store_pickup_label" text DEFAULT 'Retirada na Loja'::text,
"shipping_store_pickup_address" text,
"shipping_free_enabled" boolean DEFAULT false,
"shipping_free_label" text DEFAULT 'Frete Grátis'::text,
"shipping_free_min_value" numeric DEFAULT 0,
"shipping_regions" jsonb DEFAULT '[]'::jsonb,
"app_version" text DEFAULT ''::text,
"shipping_allowed_services" jsonb,
"header_logo_url" text,
"header_subhead_text" text DEFAULT 'Frete grátis para compras acima de R$ 399*'::text,
"header_highlight_text" text DEFAULT 'Bijuterias'::text,
"header_highlight_url" text DEFAULT '/bijuterias'::text,
"header_highlight_icon" text DEFAULT 'Percent'::text,
"header_menu_order" jsonb DEFAULT '[]'::jsonb,
"public_base_url" text,
"show_variants_on_grid" boolean DEFAULT true NOT NULL,
"favicon_url" text,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."store_setup" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"setup_completed" boolean DEFAULT false,
"current_step" integer DEFAULT 1,
"completed_steps" jsonb DEFAULT '[]'::jsonb,
"updated_at" timestamp with time zone DEFAULT now(),
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL
);

CREATE TABLE public."stripe_webhook_events" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"event_id" text NOT NULL,
"event_type" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"payload" jsonb,
"processed" boolean DEFAULT true NOT NULL,
"processed_at" timestamp with time zone,
"error_message" text,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
);

CREATE TABLE public."tenant_plans" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"slug" text NOT NULL,
"stripe_price_id_monthly" text,
"stripe_price_id_yearly" text,
"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
"sort_order" integer DEFAULT 0 NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."tenants" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"slug" text NOT NULL,
"domain" text,
"active" boolean DEFAULT true NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"plan_id" uuid,
"billing_status" text DEFAULT 'active'::text NOT NULL,
"stripe_customer_id" text,
"stripe_subscription_id" text,
"trial_ends_at" timestamp with time zone,
"plan_expires_at" timestamp with time zone
);

CREATE TABLE public."user_roles" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"role" public."app_role" DEFAULT 'user'::app_role NOT NULL
);

CREATE TABLE public."user_tenants" (
"user_id" uuid NOT NULL,
"tenant_id" uuid NOT NULL
);

CREATE TABLE public."app_logs" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"level" text DEFAULT 'info'::text NOT NULL,
"scope" text DEFAULT 'general'::text NOT NULL,
"message" text NOT NULL,
"meta" jsonb DEFAULT '{}'::jsonb,
"user_id" uuid,
"correlation_id" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
);

CREATE TABLE public."error_logs" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"error_type" text NOT NULL,
"error_message" text NOT NULL,
"error_stack" text,
"error_context" jsonb DEFAULT '{}'::jsonb,
"page_url" text,
"user_id" uuid,
"user_agent" text,
"severity" text DEFAULT 'error'::text,
"is_resolved" boolean DEFAULT false,
"resolved_at" timestamp with time zone,
"resolved_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
);

CREATE TABLE public."rate_limit_log" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"identifier" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public."admin_members" ADD CONSTRAINT "admin_members_pkey" PRIMARY KEY (id);

ALTER TABLE public."admin_members" ADD CONSTRAINT "admin_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'operator'::text, 'viewer'::text, 'super_admin'::text])));

ALTER TABLE public."admin_audit_log" ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY (id);

ALTER TABLE public."security_seals" ADD CONSTRAINT "security_seals_pkey" PRIMARY KEY (id);

ALTER TABLE public."home_page_sections" ADD CONSTRAINT "home_page_sections_pkey" PRIMARY KEY (id);

ALTER TABLE public."home_page_sections" ADD CONSTRAINT "home_page_sections_section_key_key" UNIQUE (section_key);

ALTER TABLE public."home_sections" ADD CONSTRAINT "home_sections_pkey" PRIMARY KEY (id);

ALTER TABLE public."payment_methods_display" ADD CONSTRAINT "payment_methods_display_pkey" PRIMARY KEY (id);

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_user_id_key" UNIQUE (user_id);

ALTER TABLE public."highlight_banners" ADD CONSTRAINT "highlight_banners_pkey" PRIMARY KEY (id);

ALTER TABLE public."stripe_webhook_events" ADD CONSTRAINT "stripe_webhook_events_event_id_key" UNIQUE (event_id);

ALTER TABLE public."stripe_webhook_events" ADD CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY (id);

ALTER TABLE public."help_articles" ADD CONSTRAINT "help_articles_key_key" UNIQUE (key);

ALTER TABLE public."help_articles" ADD CONSTRAINT "help_articles_pkey" PRIMARY KEY (id);

ALTER TABLE public."store_settings" ADD CONSTRAINT "store_settings_pkey" PRIMARY KEY (id);

ALTER TABLE public."payment_pricing_config" ADD CONSTRAINT "payment_pricing_config_interest_mode_check" CHECK ((interest_mode = ANY (ARRAY['fixed'::text, 'by_installment'::text])));

ALTER TABLE public."payment_pricing_config" ADD CONSTRAINT "payment_pricing_config_pkey" PRIMARY KEY (id);

ALTER TABLE public."payment_pricing_config" ADD CONSTRAINT "payment_pricing_config_rounding_mode_check" CHECK ((rounding_mode = ANY (ARRAY['adjust_last'::text, 'truncate'::text])));

ALTER TABLE public."store_setup" ADD CONSTRAINT "store_setup_pkey" PRIMARY KEY (id);

ALTER TABLE public."announcement_bar" ADD CONSTRAINT "announcement_bar_pkey" PRIMARY KEY (id);

ALTER TABLE public."log_daily_stats" ADD CONSTRAINT "log_daily_stats_pkey" PRIMARY KEY (id);

ALTER TABLE public."log_daily_stats" ADD CONSTRAINT "log_daily_stats_stat_date_log_source_key" UNIQUE (stat_date, log_source);

ALTER TABLE public."features_bar" ADD CONSTRAINT "features_bar_pkey" PRIMARY KEY (id);

ALTER TABLE public."login_attempts" ADD CONSTRAINT "login_attempts_pkey" PRIMARY KEY (id);

ALTER TABLE public."rate_limit_log" ADD CONSTRAINT "rate_limit_log_pkey" PRIMARY KEY (id);

ALTER TABLE public."cleanup_runs" ADD CONSTRAINT "cleanup_runs_pkey" PRIMARY KEY (id);

ALTER TABLE public."site_theme" ADD CONSTRAINT "site_theme_pkey" PRIMARY KEY (id);

ALTER TABLE public."banners" ADD CONSTRAINT "banners_pkey" PRIMARY KEY (id);

ALTER TABLE public."blog_posts" ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY (id);

ALTER TABLE public."blog_posts" ADD CONSTRAINT "blog_posts_slug_key" UNIQUE (slug);

ALTER TABLE public."blog_posts" ADD CONSTRAINT "blog_posts_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])));

ALTER TABLE public."error_logs" ADD CONSTRAINT "error_logs_pkey" PRIMARY KEY (id);

ALTER TABLE public."payment_pricing_audit_log" ADD CONSTRAINT "payment_pricing_audit_log_pkey" PRIMARY KEY (id);

ALTER TABLE public."instagram_videos" ADD CONSTRAINT "instagram_videos_pkey" PRIMARY KEY (id);

ALTER TABLE public."blog_settings" ADD CONSTRAINT "blog_settings_pkey" PRIMARY KEY (id);

ALTER TABLE public."social_links" ADD CONSTRAINT "social_links_pkey" PRIMARY KEY (id);

ALTER TABLE public."page_contents" ADD CONSTRAINT "page_contents_page_slug_key" UNIQUE (page_slug);

ALTER TABLE public."page_contents" ADD CONSTRAINT "page_contents_pkey" PRIMARY KEY (id);

ALTER TABLE public."categories" ADD CONSTRAINT "categories_pkey" PRIMARY KEY (id);

ALTER TABLE public."categories" ADD CONSTRAINT "categories_slug_key" UNIQUE (slug);

ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_domain_key" UNIQUE (domain);

ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_pkey" PRIMARY KEY (id);

ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_slug_key" UNIQUE (slug);

ALTER TABLE public."homepage_testimonials_config" ADD CONSTRAINT "homepage_testimonials_config_pkey" PRIMARY KEY (id);

ALTER TABLE public."app_logs" ADD CONSTRAINT "app_logs_pkey" PRIMARY KEY (id);

ALTER TABLE public."tenant_plans" ADD CONSTRAINT "tenant_plans_pkey" PRIMARY KEY (id);

ALTER TABLE public."tenant_plans" ADD CONSTRAINT "tenant_plans_slug_key" UNIQUE (slug);

ALTER TABLE public."user_tenants" ADD CONSTRAINT "user_tenants_pkey" PRIMARY KEY (user_id);

ALTER TABLE public."homepage_testimonials" ADD CONSTRAINT "homepage_testimonials_pkey" PRIMARY KEY (id);

ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY (id);

ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE (user_id, role);

ALTER TABLE public."admin_members" ADD CONSTRAINT "admin_members_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id);

ALTER TABLE public."admin_members" ADD CONSTRAINT "admin_members_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."admin_members" ADD CONSTRAINT "admin_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."admin_audit_log" ADD CONSTRAINT "admin_audit_log_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."admin_audit_log" ADD CONSTRAINT "admin_audit_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public."security_seals" ADD CONSTRAINT "security_seals_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."home_page_sections" ADD CONSTRAINT "home_page_sections_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."home_sections" ADD CONSTRAINT "home_sections_category_id_fkey" FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE public."home_sections" ADD CONSTRAINT "home_sections_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."payment_methods_display" ADD CONSTRAINT "payment_methods_display_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."highlight_banners" ADD CONSTRAINT "highlight_banners_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."stripe_webhook_events" ADD CONSTRAINT "stripe_webhook_events_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."help_articles" ADD CONSTRAINT "help_articles_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."store_settings" ADD CONSTRAINT "store_settings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE public."payment_pricing_config" ADD CONSTRAINT "payment_pricing_config_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."payment_pricing_config" ADD CONSTRAINT "payment_pricing_config_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);

ALTER TABLE public."store_setup" ADD CONSTRAINT "store_setup_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."announcement_bar" ADD CONSTRAINT "announcement_bar_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."log_daily_stats" ADD CONSTRAINT "log_daily_stats_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."features_bar" ADD CONSTRAINT "features_bar_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."login_attempts" ADD CONSTRAINT "login_attempts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."cleanup_runs" ADD CONSTRAINT "cleanup_runs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."site_theme" ADD CONSTRAINT "site_theme_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."banners" ADD CONSTRAINT "banners_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE public."blog_posts" ADD CONSTRAINT "blog_posts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."error_logs" ADD CONSTRAINT "error_logs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."payment_pricing_audit_log" ADD CONSTRAINT "payment_pricing_audit_log_config_id_fkey" FOREIGN KEY (config_id) REFERENCES payment_pricing_config(id);

ALTER TABLE public."payment_pricing_audit_log" ADD CONSTRAINT "payment_pricing_audit_log_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."instagram_videos" ADD CONSTRAINT "instagram_videos_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."blog_settings" ADD CONSTRAINT "blog_settings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."social_links" ADD CONSTRAINT "social_links_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."page_contents" ADD CONSTRAINT "page_contents_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."categories" ADD CONSTRAINT "categories_parent_category_id_fkey" FOREIGN KEY (parent_category_id) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE public."categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES tenant_plans(id) ON DELETE SET NULL;

ALTER TABLE public."homepage_testimonials_config" ADD CONSTRAINT "homepage_testimonials_config_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."app_logs" ADD CONSTRAINT "app_logs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."user_tenants" ADD CONSTRAINT "user_tenants_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE public."user_tenants" ADD CONSTRAINT "user_tenants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."homepage_testimonials" ADD CONSTRAINT "homepage_testimonials_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid() LIMIT 1),
    '00000000-0000-0000-0000-000000000001'::uuid
  );
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.profiles (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_members
    WHERE user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'owner')
      AND is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_highlight_banners_updated_at BEFORE UPDATE ON public.highlight_banners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_settings_updated_at BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_home_sections_updated_at BEFORE UPDATE ON public.home_sections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_features_bar_updated_at BEFORE UPDATE ON public.features_bar FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_display_updated_at BEFORE UPDATE ON public.payment_methods_display FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_security_seals_updated_at BEFORE UPDATE ON public.security_seals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_page_contents_updated_at BEFORE UPDATE ON public.page_contents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_pricing_config_updated_at BEFORE UPDATE ON public.payment_pricing_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_help_articles_updated_at BEFORE UPDATE ON public.help_articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_links_updated_at BEFORE UPDATE ON public.social_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_site_theme_updated_at BEFORE UPDATE ON public.site_theme FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_homepage_testimonials_config_updated_at BEFORE UPDATE ON public.homepage_testimonials_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_homepage_testimonials_updated_at BEFORE UPDATE ON public.homepage_testimonials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_home_page_sections_updated_at BEFORE UPDATE ON public.home_page_sections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_setup_updated_at BEFORE UPDATE ON public.store_setup FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_settings_updated_at BEFORE UPDATE ON public.blog_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public."admin_audit_log" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."admin_audit_log" FROM anon, authenticated;

GRANT ALL ON public."admin_audit_log" TO service_role;

CREATE POLICY "Select audit log by tenant" ON public."admin_audit_log" AS PERMISSIVE FOR SELECT TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT ON public."admin_audit_log" TO "anon", "authenticated";

CREATE POLICY "Insert audit log by tenant" ON public."admin_audit_log" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT INSERT ON public."admin_audit_log" TO "anon", "authenticated";

ALTER TABLE public."admin_members" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."admin_members" FROM anon, authenticated;

GRANT ALL ON public."admin_members" TO service_role;

CREATE POLICY "Select admin members by tenant" ON public."admin_members" AS PERMISSIVE FOR SELECT TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT ON public."admin_members" TO "anon", "authenticated";

CREATE POLICY "Owner manage admin members by tenant" ON public."admin_members" AS PERMISSIVE FOR ALL TO "public" USING ((is_owner() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."admin_members" TO "anon", "authenticated";

ALTER TABLE public."announcement_bar" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."announcement_bar" FROM anon, authenticated;

GRANT ALL ON public."announcement_bar" TO service_role;

CREATE POLICY "Select announcement by tenant" ON public."announcement_bar" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."announcement_bar" TO "anon", "authenticated";

CREATE POLICY "Admin manage announcement by tenant" ON public."announcement_bar" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."announcement_bar" TO "anon", "authenticated";

ALTER TABLE public."banners" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."banners" FROM anon, authenticated;

GRANT ALL ON public."banners" TO service_role;

CREATE POLICY "Select banners by tenant" ON public."banners" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin() OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text)));

GRANT SELECT ON public."banners" TO "anon", "authenticated";

CREATE POLICY "Admins manage banners by tenant" ON public."banners" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin() OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text))));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."banners" TO "anon", "authenticated";

ALTER TABLE public."blog_posts" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."blog_posts" FROM anon, authenticated;

GRANT ALL ON public."blog_posts" TO service_role;

CREATE POLICY "Select blog posts by tenant" ON public."blog_posts" AS PERMISSIVE FOR SELECT TO "public" USING ((((status = 'published'::text) OR is_admin()) AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT ON public."blog_posts" TO "anon", "authenticated";

CREATE POLICY "Admin manage blog posts by tenant" ON public."blog_posts" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."blog_posts" TO "anon", "authenticated";

ALTER TABLE public."blog_settings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."blog_settings" FROM anon, authenticated;

GRANT ALL ON public."blog_settings" TO service_role;

CREATE POLICY "Select blog settings by tenant" ON public."blog_settings" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."blog_settings" TO "anon", "authenticated";

CREATE POLICY "Admin manage blog settings by tenant" ON public."blog_settings" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."blog_settings" TO "anon", "authenticated";

ALTER TABLE public."categories" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."categories" FROM anon, authenticated;

GRANT ALL ON public."categories" TO service_role;

CREATE POLICY "Select categories by tenant" ON public."categories" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin() OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text)));

GRANT SELECT ON public."categories" TO "anon", "authenticated";

CREATE POLICY "Admins manage categories by tenant" ON public."categories" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin() OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text))));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."categories" TO "anon", "authenticated";

ALTER TABLE public."cleanup_runs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."cleanup_runs" FROM anon, authenticated;

GRANT ALL ON public."cleanup_runs" TO service_role;

CREATE POLICY "Admins can view cleanup_runs" ON public."cleanup_runs" AS PERMISSIVE FOR SELECT TO "public" USING (is_admin());

GRANT SELECT ON public."cleanup_runs" TO "anon", "authenticated";

CREATE POLICY "Service can insert cleanup_runs" ON public."cleanup_runs" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (is_admin());

GRANT INSERT ON public."cleanup_runs" TO "anon", "authenticated";

CREATE POLICY "Service can update cleanup_runs" ON public."cleanup_runs" AS PERMISSIVE FOR UPDATE TO "public" USING (is_admin());

GRANT UPDATE ON public."cleanup_runs" TO "anon", "authenticated";

ALTER TABLE public."features_bar" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."features_bar" FROM anon, authenticated;

GRANT ALL ON public."features_bar" TO service_role;

CREATE POLICY "Anyone can view features_bar" ON public."features_bar" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."features_bar" TO "anon", "authenticated";

CREATE POLICY "Select features bar by tenant" ON public."features_bar" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."features_bar" TO "anon", "authenticated";

CREATE POLICY "Admin manage features bar by tenant" ON public."features_bar" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."features_bar" TO "anon", "authenticated";

ALTER TABLE public."help_articles" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."help_articles" FROM anon, authenticated;

GRANT ALL ON public."help_articles" TO service_role;

CREATE POLICY "Admins can manage help articles" ON public."help_articles" AS PERMISSIVE FOR ALL TO "public" USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public."help_articles" TO "anon", "authenticated";

CREATE POLICY "Public read non-admin help articles" ON public."help_articles" AS PERMISSIVE FOR SELECT TO "public" USING (((audience IS DISTINCT FROM 'admin'::text) OR is_admin()));

GRANT SELECT ON public."help_articles" TO "anon", "authenticated";

ALTER TABLE public."highlight_banners" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."highlight_banners" FROM anon, authenticated;

GRANT ALL ON public."highlight_banners" TO service_role;

CREATE POLICY "Admins can manage highlight banners" ON public."highlight_banners" AS PERMISSIVE FOR ALL TO "public" USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public."highlight_banners" TO "anon", "authenticated";

CREATE POLICY "Anyone can view active highlight banners" ON public."highlight_banners" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."highlight_banners" TO "anon", "authenticated";

CREATE POLICY "Public Read" ON public."highlight_banners" AS PERMISSIVE FOR SELECT TO "anon" USING (true);

GRANT SELECT ON public."highlight_banners" TO "anon";

CREATE POLICY "Select highlight banners by tenant" ON public."highlight_banners" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."highlight_banners" TO "anon", "authenticated";

CREATE POLICY "Admin manage highlight banners by tenant" ON public."highlight_banners" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."highlight_banners" TO "anon", "authenticated";

ALTER TABLE public."home_page_sections" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."home_page_sections" FROM anon, authenticated;

GRANT ALL ON public."home_page_sections" TO service_role;

CREATE POLICY "Anyone can view active home_page_sections" ON public."home_page_sections" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."home_page_sections" TO "anon", "authenticated";

CREATE POLICY "Select home page sections by tenant" ON public."home_page_sections" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."home_page_sections" TO "anon", "authenticated";

CREATE POLICY "Admin manage home page sections by tenant" ON public."home_page_sections" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."home_page_sections" TO "anon", "authenticated";

ALTER TABLE public."home_sections" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."home_sections" FROM anon, authenticated;

GRANT ALL ON public."home_sections" TO service_role;

CREATE POLICY "Anyone can view active home sections" ON public."home_sections" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."home_sections" TO "anon", "authenticated";

CREATE POLICY "Admins can manage home sections" ON public."home_sections" AS PERMISSIVE FOR ALL TO "public" USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public."home_sections" TO "anon", "authenticated";

CREATE POLICY "Select home sections by tenant" ON public."home_sections" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."home_sections" TO "anon", "authenticated";

CREATE POLICY "Admin manage home sections by tenant" ON public."home_sections" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."home_sections" TO "anon", "authenticated";

ALTER TABLE public."homepage_testimonials" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."homepage_testimonials" FROM anon, authenticated;

GRANT ALL ON public."homepage_testimonials" TO service_role;

CREATE POLICY "Anyone can view active testimonials" ON public."homepage_testimonials" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."homepage_testimonials" TO "anon", "authenticated";

CREATE POLICY "Select testimonials by tenant" ON public."homepage_testimonials" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."homepage_testimonials" TO "anon", "authenticated";

CREATE POLICY "Admin manage testimonials by tenant" ON public."homepage_testimonials" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."homepage_testimonials" TO "anon", "authenticated";

ALTER TABLE public."homepage_testimonials_config" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."homepage_testimonials_config" FROM anon, authenticated;

GRANT ALL ON public."homepage_testimonials_config" TO service_role;

CREATE POLICY "Anyone can view testimonials config" ON public."homepage_testimonials_config" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."homepage_testimonials_config" TO "anon", "authenticated";

CREATE POLICY "Admins can manage testimonials config" ON public."homepage_testimonials_config" AS PERMISSIVE FOR ALL TO "public" USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public."homepage_testimonials_config" TO "anon", "authenticated";

CREATE POLICY "Select testimonials config by tenant" ON public."homepage_testimonials_config" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."homepage_testimonials_config" TO "anon", "authenticated";

CREATE POLICY "Admin manage testimonials config by tenant" ON public."homepage_testimonials_config" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."homepage_testimonials_config" TO "anon", "authenticated";

ALTER TABLE public."instagram_videos" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."instagram_videos" FROM anon, authenticated;

GRANT ALL ON public."instagram_videos" TO service_role;

CREATE POLICY "Anyone can view active instagram videos" ON public."instagram_videos" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."instagram_videos" TO "anon", "authenticated";

CREATE POLICY "Admins can manage instagram videos" ON public."instagram_videos" AS PERMISSIVE FOR ALL TO "public" USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public."instagram_videos" TO "anon", "authenticated";

CREATE POLICY "Anon view instagram" ON public."instagram_videos" AS PERMISSIVE FOR SELECT TO "anon" USING (true);

GRANT SELECT ON public."instagram_videos" TO "anon";

CREATE POLICY "Select instagram videos by tenant" ON public."instagram_videos" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."instagram_videos" TO "anon", "authenticated";

CREATE POLICY "Admin manage instagram videos by tenant" ON public."instagram_videos" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."instagram_videos" TO "anon", "authenticated";

ALTER TABLE public."log_daily_stats" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."log_daily_stats" FROM anon, authenticated;

GRANT ALL ON public."log_daily_stats" TO service_role;

CREATE POLICY "Admins can view log_daily_stats" ON public."log_daily_stats" AS PERMISSIVE FOR SELECT TO "public" USING (is_admin());

GRANT SELECT ON public."log_daily_stats" TO "anon", "authenticated";

CREATE POLICY "Service can insert log_daily_stats" ON public."log_daily_stats" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (is_admin());

GRANT INSERT ON public."log_daily_stats" TO "anon", "authenticated";

ALTER TABLE public."login_attempts" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."login_attempts" FROM anon, authenticated;

GRANT ALL ON public."login_attempts" TO service_role;

CREATE POLICY "Admins can view login attempts" ON public."login_attempts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public."login_attempts" TO "authenticated";

CREATE POLICY "Anyone can insert login attempts" ON public."login_attempts" AS PERMISSIVE FOR INSERT TO "anon", "authenticated" WITH CHECK (true);

GRANT INSERT ON public."login_attempts" TO "anon", "authenticated";

ALTER TABLE public."page_contents" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."page_contents" FROM anon, authenticated;

GRANT ALL ON public."page_contents" TO service_role;

CREATE POLICY "Anyone can view page_contents" ON public."page_contents" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."page_contents" TO "anon", "authenticated";

CREATE POLICY "Select page contents by tenant" ON public."page_contents" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."page_contents" TO "anon", "authenticated";

CREATE POLICY "Admin manage page contents by tenant" ON public."page_contents" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."page_contents" TO "anon", "authenticated";

ALTER TABLE public."payment_methods_display" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."payment_methods_display" FROM anon, authenticated;

GRANT ALL ON public."payment_methods_display" TO service_role;

CREATE POLICY "Admin manage payment methods by tenant" ON public."payment_methods_display" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."payment_methods_display" TO "anon", "authenticated";

CREATE POLICY "Anyone can view payment_methods_display" ON public."payment_methods_display" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."payment_methods_display" TO "anon", "authenticated";

CREATE POLICY "Select payment methods by tenant" ON public."payment_methods_display" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."payment_methods_display" TO "anon", "authenticated";

ALTER TABLE public."payment_pricing_audit_log" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."payment_pricing_audit_log" FROM anon, authenticated;

GRANT ALL ON public."payment_pricing_audit_log" TO service_role;

CREATE POLICY "Admins can view audit log" ON public."payment_pricing_audit_log" AS PERMISSIVE FOR SELECT TO "public" USING (is_admin());

GRANT SELECT ON public."payment_pricing_audit_log" TO "anon", "authenticated";

CREATE POLICY "Admins can insert audit log" ON public."payment_pricing_audit_log" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (is_admin());

GRANT INSERT ON public."payment_pricing_audit_log" TO "anon", "authenticated";

ALTER TABLE public."payment_pricing_config" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."payment_pricing_config" FROM anon, authenticated;

GRANT ALL ON public."payment_pricing_config" TO service_role;

CREATE POLICY "Select pricing config by tenant" ON public."payment_pricing_config" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."payment_pricing_config" TO "anon", "authenticated";

CREATE POLICY "Anyone can view active pricing config" ON public."payment_pricing_config" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."payment_pricing_config" TO "anon", "authenticated";

CREATE POLICY "Admins can manage pricing config" ON public."payment_pricing_config" AS PERMISSIVE FOR ALL TO "public" USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public."payment_pricing_config" TO "anon", "authenticated";

CREATE POLICY "Admin manage pricing config by tenant" ON public."payment_pricing_config" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."payment_pricing_config" TO "anon", "authenticated";

ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."profiles" FROM anon, authenticated;

GRANT ALL ON public."profiles" TO service_role;

CREATE POLICY "Users can insert own profile" ON public."profiles" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK ((user_id = auth.uid()));

GRANT INSERT ON public."profiles" TO "anon", "authenticated";

CREATE POLICY "Users can update own profile" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "public" USING (((user_id = auth.uid()) OR is_admin()));

GRANT UPDATE ON public."profiles" TO "anon", "authenticated";

CREATE POLICY "Users can view own profile" ON public."profiles" AS PERMISSIVE FOR SELECT TO "public" USING (((user_id = auth.uid()) OR is_admin()));

GRANT SELECT ON public."profiles" TO "anon", "authenticated";

ALTER TABLE public."security_seals" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."security_seals" FROM anon, authenticated;

GRANT ALL ON public."security_seals" TO service_role;

CREATE POLICY "Anyone can view security_seals" ON public."security_seals" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."security_seals" TO "anon", "authenticated";

CREATE POLICY "Select security seals by tenant" ON public."security_seals" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."security_seals" TO "anon", "authenticated";

CREATE POLICY "Admin manage security seals by tenant" ON public."security_seals" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."security_seals" TO "anon", "authenticated";

ALTER TABLE public."site_theme" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."site_theme" FROM anon, authenticated;

GRANT ALL ON public."site_theme" TO service_role;

CREATE POLICY "Anyone can view site theme" ON public."site_theme" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."site_theme" TO "anon", "authenticated";

CREATE POLICY "Admins can manage site theme" ON public."site_theme" AS PERMISSIVE FOR ALL TO "public" USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public."site_theme" TO "anon", "authenticated";

CREATE POLICY "Select site theme by tenant" ON public."site_theme" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."site_theme" TO "anon", "authenticated";

CREATE POLICY "Admin manage site theme by tenant" ON public."site_theme" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."site_theme" TO "anon", "authenticated";

ALTER TABLE public."social_links" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."social_links" FROM anon, authenticated;

GRANT ALL ON public."social_links" TO service_role;

CREATE POLICY "Anyone can view active social links" ON public."social_links" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."social_links" TO "anon", "authenticated";

CREATE POLICY "Admins can manage social links" ON public."social_links" AS PERMISSIVE FOR ALL TO "public" USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public."social_links" TO "anon", "authenticated";

CREATE POLICY "Select social links by tenant" ON public."social_links" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."social_links" TO "anon", "authenticated";

CREATE POLICY "Admin manage social links by tenant" ON public."social_links" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."social_links" TO "anon", "authenticated";

ALTER TABLE public."store_settings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."store_settings" FROM anon, authenticated;

GRANT ALL ON public."store_settings" TO service_role;

CREATE POLICY "Select store_settings by tenant" ON public."store_settings" AS PERMISSIVE FOR SELECT TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin() OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text))));

GRANT SELECT ON public."store_settings" TO "anon", "authenticated";

CREATE POLICY "Admins manage store_settings by tenant" ON public."store_settings" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin() OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text))));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."store_settings" TO "anon", "authenticated";

ALTER TABLE public."store_setup" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."store_setup" FROM anon, authenticated;

GRANT ALL ON public."store_setup" TO service_role;

CREATE POLICY "Admins can manage setup" ON public."store_setup" AS PERMISSIVE FOR ALL TO "public" USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public."store_setup" TO "anon", "authenticated";

CREATE POLICY "Anyone can view setup" ON public."store_setup" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."store_setup" TO "anon", "authenticated";

CREATE POLICY "Select store setup by tenant" ON public."store_setup" AS PERMISSIVE FOR SELECT TO "public" USING (((tenant_id = get_current_tenant_id()) OR is_super_admin()));

GRANT SELECT ON public."store_setup" TO "anon", "authenticated";

CREATE POLICY "Admin manage store setup by tenant" ON public."store_setup" AS PERMISSIVE FOR ALL TO "public" USING ((is_admin() AND ((tenant_id = get_current_tenant_id()) OR is_super_admin())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."store_setup" TO "anon", "authenticated";

ALTER TABLE public."stripe_webhook_events" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."stripe_webhook_events" FROM anon, authenticated;

GRANT ALL ON public."stripe_webhook_events" TO service_role;

CREATE POLICY "Admins can view stripe webhook events" ON public."stripe_webhook_events" AS PERMISSIVE FOR SELECT TO "public" USING (is_admin());

GRANT SELECT ON public."stripe_webhook_events" TO "anon", "authenticated";

CREATE POLICY "Service can insert stripe webhook events" ON public."stripe_webhook_events" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK (is_admin());

GRANT INSERT ON public."stripe_webhook_events" TO "anon", "authenticated";

ALTER TABLE public."tenant_plans" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."tenant_plans" FROM anon, authenticated;

GRANT ALL ON public."tenant_plans" TO service_role;

CREATE POLICY "Service role full access tenant_plans" ON public."tenant_plans" AS PERMISSIVE FOR ALL TO "public" USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."tenant_plans" TO "anon", "authenticated";

CREATE POLICY "Anyone can read tenant_plans" ON public."tenant_plans" AS PERMISSIVE FOR SELECT TO "public" USING (true);

GRANT SELECT ON public."tenant_plans" TO "anon", "authenticated";

ALTER TABLE public."tenants" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."tenants" FROM anon, authenticated;

GRANT ALL ON public."tenants" TO service_role;

CREATE POLICY "Service role full access tenants" ON public."tenants" AS PERMISSIVE FOR ALL TO "public" USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."tenants" TO "anon", "authenticated";

CREATE POLICY "Admins can read tenants" ON public."tenants" AS PERMISSIVE FOR SELECT TO "public" USING (is_admin());

GRANT SELECT ON public."tenants" TO "anon", "authenticated";

ALTER TABLE public."user_roles" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."user_roles" FROM anon, authenticated;

GRANT ALL ON public."user_roles" TO service_role;

CREATE POLICY "Admins can manage roles" ON public."user_roles" AS PERMISSIVE FOR ALL TO "public" USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public."user_roles" TO "anon", "authenticated";

CREATE POLICY "Admins can view all roles" ON public."user_roles" AS PERMISSIVE FOR SELECT TO "public" USING ((is_admin() OR (user_id = auth.uid())));

GRANT SELECT ON public."user_roles" TO "anon", "authenticated";

ALTER TABLE public."user_tenants" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."user_tenants" FROM anon, authenticated;

GRANT ALL ON public."user_tenants" TO service_role;

CREATE POLICY "Users can read own user_tenants" ON public."user_tenants" AS PERMISSIVE FOR SELECT TO "public" USING ((user_id = auth.uid()));

GRANT SELECT ON public."user_tenants" TO "anon", "authenticated";

CREATE POLICY "Service and super_admin can manage user_tenants" ON public."user_tenants" AS PERMISSIVE FOR ALL TO "public" USING ((((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM admin_members
  WHERE ((admin_members.user_id = auth.uid()) AND (admin_members.role = ANY (ARRAY['super_admin'::text, 'owner'::text])) AND (admin_members.is_active = true))))));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."user_tenants" TO "anon", "authenticated";

ALTER TABLE public."app_logs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."app_logs" FROM anon, authenticated;

GRANT ALL ON public."app_logs" TO service_role;

CREATE POLICY "Admins can view app logs" ON public."app_logs" AS PERMISSIVE FOR SELECT TO "public" USING (is_admin());

GRANT SELECT ON public."app_logs" TO "anon", "authenticated";

CREATE POLICY "Admins can delete app logs" ON public."app_logs" AS PERMISSIVE FOR DELETE TO "public" USING (is_admin());

GRANT DELETE ON public."app_logs" TO "anon", "authenticated";

CREATE POLICY "Service can insert app logs" ON public."app_logs" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK ((((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR is_admin()));

GRANT INSERT ON public."app_logs" TO "anon", "authenticated";

ALTER TABLE public."error_logs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."error_logs" FROM anon, authenticated;

GRANT ALL ON public."error_logs" TO service_role;

CREATE POLICY "View errors" ON public."error_logs" AS PERMISSIVE FOR SELECT TO "public" USING (is_admin());

GRANT SELECT ON public."error_logs" TO "anon", "authenticated";

CREATE POLICY "Update errors" ON public."error_logs" AS PERMISSIVE FOR UPDATE TO "public" USING (is_admin());

GRANT UPDATE ON public."error_logs" TO "anon", "authenticated";

CREATE POLICY "Delete errors" ON public."error_logs" AS PERMISSIVE FOR DELETE TO "public" USING (is_admin());

GRANT DELETE ON public."error_logs" TO "anon", "authenticated";

CREATE POLICY "Insert errors" ON public."error_logs" AS PERMISSIVE FOR INSERT TO "public" WITH CHECK ((((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR is_admin()));

GRANT INSERT ON public."error_logs" TO "anon", "authenticated";

ALTER TABLE public."rate_limit_log" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."rate_limit_log" FROM anon, authenticated;

GRANT ALL ON public."rate_limit_log" TO service_role;

CREATE POLICY "rate_limit_log_service_role_only" ON public."rate_limit_log" AS PERMISSIVE FOR ALL TO "public" USING ((auth.role() = 'service_role'::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."rate_limit_log" TO "anon", "authenticated";

CREATE INDEX idx_admin_members_tenant_id ON public.admin_members USING btree (tenant_id);

CREATE INDEX idx_admin_audit_log_tenant_id ON public.admin_audit_log USING btree (tenant_id);

CREATE INDEX idx_audit_log_created ON public.admin_audit_log USING btree (created_at DESC);

CREATE INDEX idx_audit_log_resource ON public.admin_audit_log USING btree (resource_type, resource_id);

CREATE INDEX idx_security_seals_tenant_id ON public.security_seals USING btree (tenant_id);

CREATE INDEX idx_home_page_sections_tenant_id ON public.home_page_sections USING btree (tenant_id);

CREATE INDEX idx_home_sections_tenant_id ON public.home_sections USING btree (tenant_id);

CREATE INDEX idx_payment_methods_display_tenant_id ON public.payment_methods_display USING btree (tenant_id);

CREATE INDEX idx_highlight_banners_tenant_id ON public.highlight_banners USING btree (tenant_id);

CREATE INDEX idx_stripe_webhook_events_event_id ON public.stripe_webhook_events USING btree (event_id);

CREATE INDEX idx_stripe_webhook_events_tenant_id ON public.stripe_webhook_events USING btree (tenant_id);

CREATE INDEX idx_help_articles_tenant_id ON public.help_articles USING btree (tenant_id);

CREATE INDEX idx_payment_pricing_config_tenant_id ON public.payment_pricing_config USING btree (tenant_id);

CREATE INDEX idx_store_setup_tenant_id ON public.store_setup USING btree (tenant_id);

CREATE INDEX idx_announcement_bar_tenant_id ON public.announcement_bar USING btree (tenant_id);

CREATE INDEX idx_log_daily_stats_date ON public.log_daily_stats USING btree (stat_date DESC);

CREATE INDEX idx_log_daily_stats_tenant_id ON public.log_daily_stats USING btree (tenant_id);

CREATE INDEX idx_features_bar_tenant_id ON public.features_bar USING btree (tenant_id);

CREATE INDEX idx_login_attempts_email_time ON public.login_attempts USING btree (email, attempted_at DESC);

CREATE INDEX idx_login_attempts_attempted_at ON public.login_attempts USING btree (attempted_at);

CREATE INDEX idx_login_attempts_tenant_id ON public.login_attempts USING btree (tenant_id);

CREATE INDEX idx_rate_limit_log_identifier_created_at ON public.rate_limit_log USING btree (identifier, created_at);

CREATE INDEX idx_cleanup_runs_tenant_id ON public.cleanup_runs USING btree (tenant_id);

CREATE INDEX idx_cleanup_runs_job_type ON public.cleanup_runs USING btree (job_type, started_at DESC);

CREATE INDEX idx_site_theme_tenant_id ON public.site_theme USING btree (tenant_id);

CREATE INDEX idx_blog_posts_tenant_id ON public.blog_posts USING btree (tenant_id);

CREATE INDEX idx_blog_posts_slug ON public.blog_posts USING btree (slug);

CREATE INDEX idx_blog_posts_status ON public.blog_posts USING btree (status, published_at DESC);

CREATE INDEX idx_error_logs_tenant_id ON public.error_logs USING btree (tenant_id);

CREATE INDEX idx_error_logs_created_at ON public.error_logs USING btree (created_at);

CREATE INDEX idx_payment_pricing_audit_log_tenant_id ON public.payment_pricing_audit_log USING btree (tenant_id);

CREATE INDEX idx_instagram_videos_tenant_id ON public.instagram_videos USING btree (tenant_id);

CREATE INDEX idx_blog_settings_tenant_id ON public.blog_settings USING btree (tenant_id);

CREATE INDEX idx_social_links_tenant_id ON public.social_links USING btree (tenant_id);

CREATE INDEX idx_page_contents_tenant_id ON public.page_contents USING btree (tenant_id);

CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);

CREATE INDEX idx_categories_parent ON public.categories USING btree (parent_category_id) WHERE (is_active = true);

CREATE INDEX idx_categories_tenant_id ON public.categories USING btree (tenant_id);

CREATE UNIQUE INDEX idx_tenants_stripe_customer_id ON public.tenants USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);

CREATE UNIQUE INDEX idx_tenants_stripe_subscription_id ON public.tenants USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);

CREATE INDEX idx_tenants_plan_id ON public.tenants USING btree (plan_id);

CREATE INDEX idx_tenants_billing_status ON public.tenants USING btree (billing_status);

CREATE INDEX idx_homepage_testimonials_config_tenant_id ON public.homepage_testimonials_config USING btree (tenant_id);

CREATE INDEX idx_app_logs_tenant_id ON public.app_logs USING btree (tenant_id);

CREATE INDEX idx_app_logs_scope ON public.app_logs USING btree (scope);

CREATE INDEX idx_app_logs_level ON public.app_logs USING btree (level);

CREATE INDEX idx_app_logs_created_at ON public.app_logs USING btree (created_at DESC);

CREATE INDEX idx_app_logs_correlation_id ON public.app_logs USING btree (correlation_id) WHERE (correlation_id IS NOT NULL);

CREATE INDEX idx_homepage_testimonials_tenant_id ON public.homepage_testimonials USING btree (tenant_id);

CREATE VIEW public.store_settings_public AS  SELECT id,
    free_shipping_threshold,
    max_installments,
    installments_without_interest,
    installment_interest_rate,
    min_installment_value,
    pix_discount,
    cash_discount,
    shipping_regions,
    shipping_free_enabled,
    shipping_free_min_value,
    shipping_store_pickup_enabled,
    header_menu_order,
    show_variants_on_grid,
    created_at,
    updated_at,
    shipping_store_pickup_address,
    header_subhead_text,
    header_highlight_text,
    header_highlight_url,
    header_highlight_icon,
    app_version,
    store_name,
    logo_url,
    header_logo_url,
    favicon_url,
    contact_email,
    contact_phone,
    contact_whatsapp,
    address,
    full_address,
    cnpj,
    instagram_url,
    facebook_url,
    google_analytics_id,
    facebook_pixel_id,
    tiktok_pixel_id,
    head_code,
    body_code,
    shipping_free_label,
    shipping_store_pickup_label
   FROM store_settings;

GRANT SELECT ON public.store_settings_public TO anon, authenticated, service_role;

COMMIT;
