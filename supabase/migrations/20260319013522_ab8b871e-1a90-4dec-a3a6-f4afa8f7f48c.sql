
-- RLS policies update Part 1 (A-H)

-- abandoned_carts
DROP POLICY IF EXISTS "Admins can manage abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Anyone can insert abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Users can view own abandoned carts" ON public.abandoned_carts;
CREATE POLICY "Select abandoned carts by tenant" ON public.abandoned_carts FOR SELECT USING (((user_id = auth.uid()) OR is_admin()) AND (tenant_id = get_current_tenant_id() OR is_super_admin()));
CREATE POLICY "Insert abandoned carts by tenant" ON public.abandoned_carts FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage abandoned carts by tenant" ON public.abandoned_carts FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- admin_audit_log
DROP POLICY IF EXISTS "Admins can view audit log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "System can insert audit log" ON public.admin_audit_log;
CREATE POLICY "Select audit log by tenant" ON public.admin_audit_log FOR SELECT USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));
CREATE POLICY "Insert audit log by tenant" ON public.admin_audit_log FOR INSERT WITH CHECK (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- admin_notifications
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.admin_notifications;
CREATE POLICY "Admin manage notifications by tenant" ON public.admin_notifications FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- announcement_bar
DROP POLICY IF EXISTS "Admins can manage announcement" ON public.announcement_bar;
DROP POLICY IF EXISTS "Anyone can view announcement" ON public.announcement_bar;
CREATE POLICY "Select announcement by tenant" ON public.announcement_bar FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage announcement by tenant" ON public.announcement_bar FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- blog_posts
DROP POLICY IF EXISTS "Admins can manage blog_posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Anyone can read published blog_posts" ON public.blog_posts;
CREATE POLICY "Select blog posts by tenant" ON public.blog_posts FOR SELECT USING ((status = 'published' OR is_admin()) AND (tenant_id = get_current_tenant_id() OR is_super_admin()));
CREATE POLICY "Admin manage blog posts by tenant" ON public.blog_posts FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- blog_settings
DROP POLICY IF EXISTS "Admins can manage blog_settings" ON public.blog_settings;
DROP POLICY IF EXISTS "Anyone can read blog_settings" ON public.blog_settings;
CREATE POLICY "Select blog settings by tenant" ON public.blog_settings FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage blog settings by tenant" ON public.blog_settings FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- buy_together_products
DROP POLICY IF EXISTS "Admins can manage buy_together" ON public.buy_together_products;
DROP POLICY IF EXISTS "Anyone can read buy_together" ON public.buy_together_products;
CREATE POLICY "Select buy together by tenant" ON public.buy_together_products FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage buy together by tenant" ON public.buy_together_products FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- checkout_settings
DROP POLICY IF EXISTS "Admins can manage checkout_settings" ON public.checkout_settings;
DROP POLICY IF EXISTS "Anyone can read checkout_settings" ON public.checkout_settings;
CREATE POLICY "Select checkout settings by tenant" ON public.checkout_settings FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage checkout settings by tenant" ON public.checkout_settings FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- contact_messages
DROP POLICY IF EXISTS "Admins can manage contact_messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Anyone can insert contact_messages" ON public.contact_messages;
CREATE POLICY "Insert contact messages by tenant" ON public.contact_messages FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin view contact messages by tenant" ON public.contact_messages FOR SELECT USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- email_automations
DROP POLICY IF EXISTS "Admins can manage email_automations" ON public.email_automations;
CREATE POLICY "Admin manage email automations by tenant" ON public.email_automations FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- email_automation_logs
DROP POLICY IF EXISTS "Admins can view email_automation_logs" ON public.email_automation_logs;
CREATE POLICY "Admin view email automation logs by tenant" ON public.email_automation_logs FOR SELECT USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- favorites
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can insert own favorites" ON public.favorites;
CREATE POLICY "Select favorites by tenant" ON public.favorites FOR SELECT USING (user_id = auth.uid() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));
CREATE POLICY "Insert favorites by tenant" ON public.favorites FOR INSERT WITH CHECK (user_id = auth.uid() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));
CREATE POLICY "Delete favorites by tenant" ON public.favorites FOR DELETE USING (user_id = auth.uid() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- features_bar
DROP POLICY IF EXISTS "Admins can manage features_bar" ON public.features_bar;
DROP POLICY IF EXISTS "Anyone can read features_bar" ON public.features_bar;
CREATE POLICY "Select features bar by tenant" ON public.features_bar FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage features bar by tenant" ON public.features_bar FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- highlight_banners
DROP POLICY IF EXISTS "Admins can manage highlight_banners" ON public.highlight_banners;
DROP POLICY IF EXISTS "Anyone can read highlight_banners" ON public.highlight_banners;
DROP POLICY IF EXISTS "Anyone can view highlight banners" ON public.highlight_banners;
CREATE POLICY "Select highlight banners by tenant" ON public.highlight_banners FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage highlight banners by tenant" ON public.highlight_banners FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- home_page_sections
DROP POLICY IF EXISTS "Admins can manage home_page_sections" ON public.home_page_sections;
DROP POLICY IF EXISTS "Anyone can read home_page_sections" ON public.home_page_sections;
CREATE POLICY "Select home page sections by tenant" ON public.home_page_sections FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage home page sections by tenant" ON public.home_page_sections FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- home_sections
DROP POLICY IF EXISTS "Admins can manage home_sections" ON public.home_sections;
DROP POLICY IF EXISTS "Anyone can read home_sections" ON public.home_sections;
CREATE POLICY "Select home sections by tenant" ON public.home_sections FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage home sections by tenant" ON public.home_sections FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- homepage_testimonials
DROP POLICY IF EXISTS "Admins can manage testimonials" ON public.homepage_testimonials;
DROP POLICY IF EXISTS "Anyone can read testimonials" ON public.homepage_testimonials;
CREATE POLICY "Select testimonials by tenant" ON public.homepage_testimonials FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage testimonials by tenant" ON public.homepage_testimonials FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- homepage_testimonials_config
DROP POLICY IF EXISTS "Admins can manage testimonials_config" ON public.homepage_testimonials_config;
DROP POLICY IF EXISTS "Anyone can read testimonials_config" ON public.homepage_testimonials_config;
CREATE POLICY "Select testimonials config by tenant" ON public.homepage_testimonials_config FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage testimonials config by tenant" ON public.homepage_testimonials_config FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));
