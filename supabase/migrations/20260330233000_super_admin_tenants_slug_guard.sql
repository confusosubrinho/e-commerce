-- Permitir criação/edição de tenants ("clínicas") via painel super admin
-- e impedir slugs duplicados (case-insensitive) no banco.

-- 1) Normalização de slug
CREATE OR REPLACE FUNCTION public.normalize_tenant_slug(p_slug text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    trim(lower(coalesce(p_slug, ''))),
    '[^a-z0-9]+',
    '-',
    'g'
  )
$$;

-- Evita hífen no início/fim e mantém fallback seguro
CREATE OR REPLACE FUNCTION public.apply_normalized_tenant_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.slug := regexp_replace(public.normalize_tenant_slug(NEW.slug), '(^-|-$)', '', 'g');

  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    RAISE EXCEPTION 'Slug inválido';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_normalized_tenant_slug ON public.tenants;
CREATE TRIGGER trg_apply_normalized_tenant_slug
BEFORE INSERT OR UPDATE OF slug ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.apply_normalized_tenant_slug();

-- Normaliza legado (dados antigos)
UPDATE public.tenants
SET slug = regexp_replace(public.normalize_tenant_slug(slug), '(^-|-$)', '', 'g')
WHERE slug IS NOT NULL;

-- 2) Unicidade de slug ignorando caixa
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug_unique_ci
ON public.tenants ((lower(slug)));

-- 3) RLS: super admin consegue criar/editar/excluir tenants
DROP POLICY IF EXISTS "Admins can read tenants" ON public.tenants;
CREATE POLICY "Admins can read tenants"
  ON public.tenants FOR SELECT
  USING (public.is_admin() OR public.is_super_admin());

DROP POLICY IF EXISTS "Super admins insert tenants" ON public.tenants;
CREATE POLICY "Super admins insert tenants"
  ON public.tenants FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins update tenants" ON public.tenants;
CREATE POLICY "Super admins update tenants"
  ON public.tenants FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins delete tenants" ON public.tenants;
CREATE POLICY "Super admins delete tenants"
  ON public.tenants FOR DELETE
  USING (public.is_super_admin());
