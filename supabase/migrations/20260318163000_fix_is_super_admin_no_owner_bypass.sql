-- SECURITY FIX: is_super_admin() não deve incluir role='owner'
-- Senão, owners de um tenant ganham bypass das policies por tenant_id e podem visualizar/modificar dados de outros tenants.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_members
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_super_admin() IS 'Fase 7: True apenas se usuário é super_admin (bypass de RLS por tenant desativado para owner).';

