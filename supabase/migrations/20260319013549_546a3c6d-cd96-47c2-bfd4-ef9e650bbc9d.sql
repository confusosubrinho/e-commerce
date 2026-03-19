
-- RLS policies update Part 2 (I-Z)

-- instagram_videos
DROP POLICY IF EXISTS "Admins can manage instagram_videos" ON public.instagram_videos;
DROP POLICY IF EXISTS "Anyone can read instagram_videos" ON public.instagram_videos;
DROP POLICY IF EXISTS "Anyone can read active instagram" ON public.instagram_videos;
CREATE POLICY "Select instagram videos by tenant" ON public.instagram_videos FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage instagram videos by tenant" ON public.instagram_videos FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- newsletter_subscribers
DROP POLICY IF EXISTS "Admins can manage newsletter" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Anyone can subscribe newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Insert newsletter by tenant" ON public.newsletter_subscribers FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage newsletter by tenant" ON public.newsletter_subscribers FOR SELECT USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- page_contents
DROP POLICY IF EXISTS "Admins can manage page_contents" ON public.page_contents;
DROP POLICY IF EXISTS "Anyone can read page_contents" ON public.page_contents;
CREATE POLICY "Select page contents by tenant" ON public.page_contents FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage page contents by tenant" ON public.page_contents FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- payment_methods_display
DROP POLICY IF EXISTS "Admins can manage payment_methods_display" ON public.payment_methods_display;
DROP POLICY IF EXISTS "Anyone can read payment_methods_display" ON public.payment_methods_display;
CREATE POLICY "Select payment methods by tenant" ON public.payment_methods_display FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage payment methods by tenant" ON public.payment_methods_display FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- payment_pricing_config
DROP POLICY IF EXISTS "Admins can manage pricing_config" ON public.payment_pricing_config;
DROP POLICY IF EXISTS "Anyone can read pricing_config" ON public.payment_pricing_config;
CREATE POLICY "Select pricing config by tenant" ON public.payment_pricing_config FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage pricing config by tenant" ON public.payment_pricing_config FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- product_characteristics
DROP POLICY IF EXISTS "Admins can manage product_characteristics" ON public.product_characteristics;
DROP POLICY IF EXISTS "Anyone can read product_characteristics" ON public.product_characteristics;
CREATE POLICY "Select product characteristics by tenant" ON public.product_characteristics FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage product characteristics by tenant" ON public.product_characteristics FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- product_change_log
DROP POLICY IF EXISTS "Admins can view product_change_log" ON public.product_change_log;
CREATE POLICY "Admin view product change log by tenant" ON public.product_change_log FOR SELECT USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));
CREATE POLICY "Admin insert product change log by tenant" ON public.product_change_log FOR INSERT WITH CHECK (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- product_reviews
DROP POLICY IF EXISTS "Admins can manage product_reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Anyone can read approved product_reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Anyone can insert product_reviews" ON public.product_reviews;
CREATE POLICY "Select product reviews by tenant" ON public.product_reviews FOR SELECT USING ((status = 'approved' OR is_admin()) AND (tenant_id = get_current_tenant_id() OR is_super_admin()));
CREATE POLICY "Insert product reviews by tenant" ON public.product_reviews FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage product reviews by tenant" ON public.product_reviews FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- security_seals
DROP POLICY IF EXISTS "Admins can manage security_seals" ON public.security_seals;
DROP POLICY IF EXISTS "Anyone can read security_seals" ON public.security_seals;
CREATE POLICY "Select security seals by tenant" ON public.security_seals FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage security seals by tenant" ON public.security_seals FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- site_theme
DROP POLICY IF EXISTS "Admins can manage site_theme" ON public.site_theme;
DROP POLICY IF EXISTS "Anyone can read site_theme" ON public.site_theme;
CREATE POLICY "Select site theme by tenant" ON public.site_theme FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage site theme by tenant" ON public.site_theme FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- social_links
DROP POLICY IF EXISTS "Admins can manage social_links" ON public.social_links;
DROP POLICY IF EXISTS "Anyone can read social_links" ON public.social_links;
CREATE POLICY "Select social links by tenant" ON public.social_links FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage social links by tenant" ON public.social_links FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- stock_notifications
DROP POLICY IF EXISTS "Admins can manage stock_notifications" ON public.stock_notifications;
DROP POLICY IF EXISTS "Anyone can insert stock_notifications" ON public.stock_notifications;
CREATE POLICY "Insert stock notifications by tenant" ON public.stock_notifications FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage stock notifications by tenant" ON public.stock_notifications FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- store_setup
DROP POLICY IF EXISTS "Admins can manage store_setup" ON public.store_setup;
DROP POLICY IF EXISTS "Anyone can read store_setup" ON public.store_setup;
CREATE POLICY "Select store setup by tenant" ON public.store_setup FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage store setup by tenant" ON public.store_setup FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- variation_value_map
DROP POLICY IF EXISTS "Admins can manage variation_value_map" ON public.variation_value_map;
DROP POLICY IF EXISTS "Anyone can read variation_value_map" ON public.variation_value_map;
DROP POLICY IF EXISTS "Service role manage variation_value_map" ON public.variation_value_map;
CREATE POLICY "Select variation value map by tenant" ON public.variation_value_map FOR SELECT USING (tenant_id = get_current_tenant_id() OR is_super_admin());
CREATE POLICY "Admin manage variation value map by tenant" ON public.variation_value_map FOR ALL USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));

-- admin_members
DROP POLICY IF EXISTS "Admins can view admin_members" ON public.admin_members;
DROP POLICY IF EXISTS "Owners can manage admin_members" ON public.admin_members;
DROP POLICY IF EXISTS "Owners can manage team" ON public.admin_members;
CREATE POLICY "Select admin members by tenant" ON public.admin_members FOR SELECT USING (is_admin() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));
CREATE POLICY "Owner manage admin members by tenant" ON public.admin_members FOR ALL USING (is_owner() AND (tenant_id = get_current_tenant_id() OR is_super_admin()));
