-- Fase 7 – RLS por tenant (todas as mudanças de RLS e funções no banco nesta migration)
-- Depende de: 20260316100000_multi_tenant_schema.sql (tenants + tenant_id nas tabelas)
-- Conteúdo: user_tenants, backfill, trigger novo admin → user_tenants, get_current_tenant_id(), is_super_admin(), políticas em 14 tabelas

-- =============================================
-- 1. Tabela user_tenants (vincula usuário → tenant)
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_tenants (
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id)
);

COMMENT ON TABLE public.user_tenants IS 'Fase 7: Qual tenant cada usuário (admin) pertence. Um usuário = um tenant por enquanto.';

ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own user_tenants"
  ON public.user_tenants FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service and super_admin can manage user_tenants"
  ON public.user_tenants FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM public.admin_members WHERE user_id = auth.uid() AND role IN ('super_admin', 'owner') AND is_active = true)
  );

-- Backfill: admins existentes → tenant padrão
INSERT INTO public.user_tenants (user_id, tenant_id)
SELECT user_id, '00000000-0000-0000-0000-000000000001'::uuid
FROM public.admin_members
WHERE user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_tenants (user_id, tenant_id)
SELECT user_id, '00000000-0000-0000-0000-000000000001'::uuid
FROM public.user_roles
WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- Trigger: novos admins em admin_members ganham linha em user_tenants (tenant padrão)
CREATE OR REPLACE FUNCTION public.fn_user_tenants_on_admin_member_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_tenants (user_id, tenant_id)
    VALUES (NEW.user_id, '00000000-0000-0000-0000-000000000001'::uuid)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_tenants_on_admin_member_insert ON public.admin_members;
CREATE TRIGGER trg_user_tenants_on_admin_member_insert
  AFTER INSERT ON public.admin_members
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_user_tenants_on_admin_member_insert();

-- =============================================
-- 2. get_current_tenant_id() e is_super_admin()
-- =============================================
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid() LIMIT 1),
    '00000000-0000-0000-0000-000000000001'::uuid
  );
$$;

COMMENT ON FUNCTION public.get_current_tenant_id() IS 'Fase 7: Tenant da sessão (user_tenants ou tenant padrão para anon/loja).';

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_members
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'owner')
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_super_admin() IS 'Fase 7: True se usuário é super_admin ou owner (bypass RLS por tenant).';

-- Helper: condição de tenant para políticas (reutilizável)
-- Uso: tenant_id = get_current_tenant_id() OR is_super_admin() OR service_role

-- =============================================
-- 3. Políticas RLS por tenant (tabelas com tenant_id)
-- =============================================

-- categories
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Select categories by tenant"
  ON public.categories FOR SELECT
  USING (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role');
CREATE POLICY "Admins manage categories by tenant"
  ON public.categories FOR ALL
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));

-- products
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Select products by tenant"
  ON public.products FOR SELECT
  USING (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role');
CREATE POLICY "Admins manage products by tenant"
  ON public.products FOR ALL
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));

-- product_variants
DROP POLICY IF EXISTS "Anyone can view variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can manage variants" ON public.product_variants;
CREATE POLICY "Select product_variants by tenant"
  ON public.product_variants FOR SELECT
  USING (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role');
CREATE POLICY "Admins manage product_variants by tenant"
  ON public.product_variants FOR ALL
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));

-- product_images
DROP POLICY IF EXISTS "Anyone can view images" ON public.product_images;
DROP POLICY IF EXISTS "Admins can manage images" ON public.product_images;
CREATE POLICY "Select product_images by tenant"
  ON public.product_images FOR SELECT
  USING (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role');
CREATE POLICY "Admins manage product_images by tenant"
  ON public.product_images FOR ALL
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));

-- banners
DROP POLICY IF EXISTS "Anyone can view active banners" ON public.banners;
DROP POLICY IF EXISTS "Admins can manage banners" ON public.banners;
CREATE POLICY "Select banners by tenant"
  ON public.banners FOR SELECT
  USING (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role');
CREATE POLICY "Admins manage banners by tenant"
  ON public.banners FOR ALL
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));

-- coupons
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;
CREATE POLICY "Select coupons by tenant"
  ON public.coupons FOR SELECT
  USING ((is_active = true OR public.is_admin()) AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));
CREATE POLICY "Admins manage coupons by tenant"
  ON public.coupons FOR ALL
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));

-- customers
DROP POLICY IF EXISTS "Admins can view customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
CREATE POLICY "Select customers by tenant"
  ON public.customers FOR SELECT
  USING ((user_id = auth.uid() OR public.is_admin()) AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));
CREATE POLICY "Admins manage customers by tenant"
  ON public.customers FOR ALL
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));

-- store_settings
DROP POLICY IF EXISTS "Anyone can view settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.store_settings;
DROP POLICY IF EXISTS "Public view settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admin manage settings" ON public.store_settings;
DROP POLICY IF EXISTS "Public view settings read only" ON public.store_settings;
DROP POLICY IF EXISTS "Only admins can read store_settings" ON public.store_settings;
CREATE POLICY "Select store_settings by tenant"
  ON public.store_settings FOR SELECT
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));
CREATE POLICY "Admins manage store_settings by tenant"
  ON public.store_settings FOR ALL
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));
-- View store_settings_public (security_invoker) precisa ler store_settings; anon vê só tenant padrão
CREATE POLICY "Public read default tenant store_settings"
  ON public.store_settings FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- orders
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Guest users can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
CREATE POLICY "Select orders by tenant"
  ON public.orders FOR SELECT
  USING ((user_id = auth.uid() OR public.is_admin()) AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));
CREATE POLICY "Insert orders in tenant"
  ON public.orders FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role');
CREATE POLICY "Update orders by tenant"
  ON public.orders FOR UPDATE
  USING ((user_id = auth.uid() OR public.is_admin()) AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));
CREATE POLICY "Delete orders by tenant"
  ON public.orders FOR DELETE
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));

-- order_items
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can manage order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Select order_items by tenant"
  ON public.order_items FOR SELECT
  USING (
    tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.user_id = auth.uid() OR public.is_admin()) AND (o.tenant_id = public.get_current_tenant_id() OR public.is_super_admin()))
  );
CREATE POLICY "Insert order_items in tenant"
  ON public.order_items FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role');
CREATE POLICY "Admins manage order_items by tenant"
  ON public.order_items FOR ALL
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));

-- payments
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Service can insert payments" ON public.payments;
CREATE POLICY "Select payments by tenant"
  ON public.payments FOR SELECT
  USING (
    (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role')
    AND (public.is_admin() OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payments.order_id AND o.user_id = auth.uid()))
  );
CREATE POLICY "Admins manage payments by tenant"
  ON public.payments FOR ALL
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));
CREATE POLICY "Service insert payments"
  ON public.payments FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- inventory_movements
DROP POLICY IF EXISTS "Admins can manage inventory movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Service can insert inventory movements" ON public.inventory_movements;
CREATE POLICY "Select inventory_movements by tenant"
  ON public.inventory_movements FOR SELECT
  USING (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role');
CREATE POLICY "Admins manage inventory_movements by tenant"
  ON public.inventory_movements FOR ALL
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));
CREATE POLICY "Service insert inventory_movements"
  ON public.inventory_movements FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- integrations_checkout
DROP POLICY IF EXISTS "Admins can manage integrations_checkout" ON public.integrations_checkout;
DROP POLICY IF EXISTS "Anyone can read integrations_checkout" ON public.integrations_checkout;
CREATE POLICY "Select integrations_checkout by tenant"
  ON public.integrations_checkout FOR SELECT
  USING (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role');
CREATE POLICY "Admins manage integrations_checkout by tenant"
  ON public.integrations_checkout FOR ALL
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));

-- integrations_checkout_providers
DROP POLICY IF EXISTS "Admins can manage checkout providers" ON public.integrations_checkout_providers;
DROP POLICY IF EXISTS "Anyone can read checkout providers" ON public.integrations_checkout_providers;
CREATE POLICY "Select integrations_checkout_providers by tenant"
  ON public.integrations_checkout_providers FOR SELECT
  USING (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role');
CREATE POLICY "Admins manage integrations_checkout_providers by tenant"
  ON public.integrations_checkout_providers FOR ALL
  USING (public.is_admin() AND (tenant_id = public.get_current_tenant_id() OR public.is_super_admin() OR (auth.jwt() ->> 'role') = 'service_role'));
