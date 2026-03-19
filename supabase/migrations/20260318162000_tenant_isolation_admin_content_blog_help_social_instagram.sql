-- Tenant isolation for admin content pages that were previously tenantless:
-- - blog_settings / blog_posts
-- - social_links
-- - help_articles
-- - instagram_videos
--
-- Goal: impedir que admins de um tenant vejam/modifiquem conteúdo interno de outro tenant.
-- Observação: para evitar quebra grande, fazemos backfill em tenant padrão quando não houver inferência.

-- ==========================================================
-- 0) Constants
-- ==========================================================
-- Usamos o tenant padrão definido no projeto (get_current_tenant_id já resolve).

-- ==========================================================
-- 1) blog_settings
-- ==========================================================
ALTER TABLE public.blog_settings
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.blog_settings
SET tenant_id = public.get_current_tenant_id()
WHERE tenant_id IS NULL;

ALTER TABLE public.blog_settings
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_blog_settings_tenant_created
  ON public.blog_settings(tenant_id, created_at DESC);

DROP POLICY IF EXISTS "Admins can manage blog_settings" ON public.blog_settings;
DROP POLICY IF EXISTS "Anyone can read blog_settings" ON public.blog_settings;

CREATE POLICY "blog_settings select by tenant"
  ON public.blog_settings FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR tenant_id = public.get_current_tenant_id()
  );

CREATE POLICY "blog_settings manage by tenant admin"
  ON public.blog_settings FOR ALL
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- ==========================================================
-- 2) blog_posts
-- ==========================================================
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.blog_posts
SET tenant_id = public.get_current_tenant_id()
WHERE tenant_id IS NULL;

ALTER TABLE public.blog_posts
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_blog_posts_tenant_status
  ON public.blog_posts(tenant_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tenant_slug
  ON public.blog_posts(tenant_id, slug);

DROP POLICY IF EXISTS "Admins can manage blog_posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Anyone can read published blog_posts" ON public.blog_posts;

CREATE POLICY "blog_posts select by tenant"
  ON public.blog_posts FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      tenant_id = public.get_current_tenant_id()
      AND (status = 'published' OR public.is_admin())
    )
  );

CREATE POLICY "blog_posts manage by tenant admin"
  ON public.blog_posts FOR ALL
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- ==========================================================
-- 3) social_links
-- ==========================================================
ALTER TABLE public.social_links
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.social_links
SET tenant_id = public.get_current_tenant_id()
WHERE tenant_id IS NULL;

ALTER TABLE public.social_links
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_social_links_tenant_order
  ON public.social_links(tenant_id, sort_order ASC);

DROP POLICY IF EXISTS "Anyone can view active social links" ON public.social_links;
DROP POLICY IF EXISTS "Admins can manage social links" ON public.social_links;

CREATE POLICY "social_links select by tenant"
  ON public.social_links FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      tenant_id = public.get_current_tenant_id()
      AND (is_active = true OR public.is_admin())
    )
  );

CREATE POLICY "social_links manage by tenant admin"
  ON public.social_links FOR ALL
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- ==========================================================
-- 4) help_articles
-- ==========================================================
ALTER TABLE public.help_articles
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.help_articles
SET tenant_id = public.get_current_tenant_id()
WHERE tenant_id IS NULL;

ALTER TABLE public.help_articles
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_help_articles_tenant_key
  ON public.help_articles(tenant_id, key);

DROP POLICY IF EXISTS "Anyone can read help articles" ON public.help_articles;
DROP POLICY IF EXISTS "Admins can manage help articles" ON public.help_articles;

CREATE POLICY "help_articles select by tenant"
  ON public.help_articles FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR tenant_id = public.get_current_tenant_id()
  );

CREATE POLICY "help_articles manage by tenant admin"
  ON public.help_articles FOR ALL
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- ==========================================================
-- 5) instagram_videos
-- ==========================================================
ALTER TABLE public.instagram_videos
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.instagram_videos
SET tenant_id = public.get_current_tenant_id()
WHERE tenant_id IS NULL;

ALTER TABLE public.instagram_videos
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_instagram_videos_tenant_order
  ON public.instagram_videos(tenant_id, display_order ASC);

DROP POLICY IF EXISTS "Anyone can view active instagram videos" ON public.instagram_videos;
DROP POLICY IF EXISTS "Admins can manage instagram videos" ON public.instagram_videos;

CREATE POLICY "instagram_videos select by tenant"
  ON public.instagram_videos FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      tenant_id = public.get_current_tenant_id()
      AND (is_active = true OR public.is_admin())
    )
  );

CREATE POLICY "instagram_videos manage by tenant admin"
  ON public.instagram_videos FOR ALL
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

