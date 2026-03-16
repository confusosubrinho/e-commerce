-- Fase 5: role super_admin para área Super Admin (/admin/super)
-- Permite role 'super_admin' em admin_members (além de owner, manager, operator, viewer).

ALTER TABLE public.admin_members
  DROP CONSTRAINT IF EXISTS admin_members_role_check;

ALTER TABLE public.admin_members
  ADD CONSTRAINT admin_members_role_check
  CHECK (role IN ('owner', 'manager', 'operator', 'viewer', 'super_admin'));

COMMENT ON COLUMN public.admin_members.role IS 'owner: full access + team; manager/operator/viewer: limited; super_admin: full + Super Admin dashboard';
