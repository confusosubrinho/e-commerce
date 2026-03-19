-- Tenant isolation for admin panel internal tables:
-- - admin_notifications (tenant_id + RLS + trigger propagation)
-- - login_attempts (tenant_id + RLS)
-- - product_reviews (tenant_id + RLS, to prevent tenant admin data leakage)
--
-- Objetivo: impedir que admins de um tenant vejam/modifiquem dados internos de outros tenants.

-- =========================
-- 1) login_attempts
-- =========================
ALTER TABLE public.login_attempts
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.login_attempts
SET tenant_id = public.get_current_tenant_id()
WHERE tenant_id IS NULL;

ALTER TABLE public.login_attempts
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_login_attempts_tenant_attempted_at
  ON public.login_attempts(tenant_id, attempted_at DESC);

-- Replace RLS policies (previously tenantless)
DROP POLICY IF EXISTS "Admins can view login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Anyone can insert login attempts" ON public.login_attempts;

CREATE POLICY "login_attempts select by tenant admin"
  ON public.login_attempts
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- Allow inserts from anon/auth flows (tenant_id comes from client code when available)
CREATE POLICY "login_attempts insert tenant_id required"
  ON public.login_attempts
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
    OR tenant_id IS NOT NULL
  );

-- =========================
-- 2) product_reviews
-- =========================
ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Backfill tenant_id via the referenced product
UPDATE public.product_reviews pr
SET tenant_id = p.tenant_id
FROM public.products p
WHERE pr.tenant_id IS NULL
  AND p.id = pr.product_id;

-- Fallback for orphan reviews (should be rare)
UPDATE public.product_reviews
SET tenant_id = public.get_current_tenant_id()
WHERE tenant_id IS NULL;

ALTER TABLE public.product_reviews
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_product_reviews_tenant_created_at
  ON public.product_reviews(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_reviews_tenant_status
  ON public.product_reviews(tenant_id, status);

-- Replace RLS policies (previously tenantless admin view/manage)
DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Admins can manage reviews" ON public.product_reviews;

-- Non-admins: preserve existing behavior (published OR is_approved) WITHOUT tenant restriction.
-- Admins: force tenant scoping to avoid cross-tenant access from backoffice.
CREATE POLICY "product_reviews select published/admin tenant scoped"
  ON public.product_reviews
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (
      public.is_admin()
      AND tenant_id = public.get_current_tenant_id()
    )
    OR (
      NOT public.is_admin()
      AND (status = 'published' OR is_approved = true)
    )
  );

CREATE POLICY "product_reviews insert authenticated requires tenant_id"
  ON public.product_reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_id
        AND p.tenant_id = tenant_id
    )
  );

CREATE POLICY "product_reviews update/delete by tenant admin"
  ON public.product_reviews
  FOR ALL
  USING (
    public.is_admin()
    AND tenant_id = public.get_current_tenant_id()
  )
  WITH CHECK (
    public.is_admin()
    AND tenant_id = public.get_current_tenant_id()
  );

-- =========================
-- 3) admin_notifications
-- =========================
ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Backfill tenant_id based on embedded metadata / referenced entities
UPDATE public.admin_notifications an
SET tenant_id = o.tenant_id
FROM public.orders o
WHERE an.tenant_id IS NULL
  AND an.metadata ? 'order_id'
  AND o.id = (an.metadata->>'order_id')::uuid;

UPDATE public.admin_notifications an
SET tenant_id = pv.tenant_id
FROM public.product_variants pv
WHERE an.tenant_id IS NULL
  AND an.metadata ? 'variant_id'
  AND pv.id = (an.metadata->>'variant_id')::uuid;

UPDATE public.admin_notifications an
SET tenant_id = pr.tenant_id
FROM public.product_reviews pr
WHERE an.tenant_id IS NULL
  AND an.metadata ? 'review_id'
  AND pr.id = (an.metadata->>'review_id')::uuid;

-- Fallback for system/legacy notifications
UPDATE public.admin_notifications
SET tenant_id = public.get_current_tenant_id()
WHERE tenant_id IS NULL;

ALTER TABLE public.admin_notifications
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_admin_notifications_tenant_created_at
  ON public.admin_notifications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_tenant_is_read
  ON public.admin_notifications(tenant_id, is_read);

-- Replace RLS policies (previously tenantless admin manage)
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.admin_notifications;

-- Reads are tenant-scoped (prevents cross-tenant leakage of operational/internal items)
CREATE POLICY "admin_notifications select by tenant admin"
  ON public.admin_notifications
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR (public.is_admin() AND tenant_id = public.get_current_tenant_id())
  );

-- Admin actions (mark read/unread/delete) are tenant-scoped
CREATE POLICY "admin_notifications update by tenant admin"
  ON public.admin_notifications
  FOR UPDATE
  USING (
    public.is_admin()
    AND tenant_id = public.get_current_tenant_id()
  )
  WITH CHECK (
    public.is_admin()
    AND tenant_id = public.get_current_tenant_id()
  );

CREATE POLICY "admin_notifications delete by tenant admin"
  ON public.admin_notifications
  FOR DELETE
  USING (
    public.is_admin()
    AND tenant_id = public.get_current_tenant_id()
  );

-- Inserts are primarily done by DB triggers / service role.
CREATE POLICY "admin_notifications insert tenant_id required"
  ON public.admin_notifications
  FOR INSERT
  WITH CHECK (
    tenant_id IS NOT NULL
  );

-- =========================
-- 4) Trigger propagation (ensure tenant_id is written)
-- =========================

-- New order notification
CREATE OR REPLACE FUNCTION public.notify_new_order() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.admin_notifications (tenant_id, type, title, message, link, metadata)
  VALUES (
    NEW.tenant_id,
    'new_order',
    'Novo pedido recebido',
    'Pedido #' || NEW.order_number || ' — R$ ' || NEW.total_amount::text,
    '/admin/pedidos',
    jsonb_build_object('order_id', NEW.id, 'amount', NEW.total_amount)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- New review notification
CREATE OR REPLACE FUNCTION public.notify_new_review() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.admin_notifications (tenant_id, type, title, message, link, metadata)
  VALUES (
    NEW.tenant_id,
    'new_review',
    'Nova avaliação publicada',
    NEW.customer_name || ' avaliou um produto com ' || NEW.rating || ' estrelas',
    '/admin/avaliacoes',
    jsonb_build_object('review_id', NEW.id, 'rating', NEW.rating)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Low-stock notification
CREATE OR REPLACE FUNCTION public.notify_zero_stock() RETURNS trigger AS $$
BEGIN
  IF NEW.stock_quantity = 0 AND OLD.stock_quantity > 0 THEN
    INSERT INTO public.admin_notifications (tenant_id, type, title, message, link, metadata)
    VALUES (
      NEW.tenant_id,
      'low_stock',
      'Produto sem estoque',
      'Uma variante ficou sem estoque. Verifique seus produtos.',
      '/admin/produtos',
      jsonb_build_object('variant_id', NEW.id, 'product_id', NEW.product_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Order paid notification
CREATE OR REPLACE FUNCTION public.notify_order_paid() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'processing' AND (OLD.status IS DISTINCT FROM 'processing') THEN
    INSERT INTO public.admin_notifications (tenant_id, type, title, message, link, metadata)
    VALUES (
      NEW.tenant_id,
      'order_paid',
      'Pedido pago',
      'Pedido #' || COALESCE(NEW.order_number, NEW.id::text) || ' confirmado — R$ ' || COALESCE(NEW.total_amount, 0)::text,
      '/admin/pedidos',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'amount', NEW.total_amount)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

