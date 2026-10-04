BEGIN;
DO $$
DECLARE admin_id uuid;
BEGIN
  SELECT user_id INTO STRICT admin_id FROM public.user_roles WHERE role='admin';
  PERFORM set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
END $$;
SET LOCAL ROLE authenticated;
SELECT public.is_admin() AS admin_authorized,
       (SELECT count(*) FROM public.store_settings) AS settings_visible,
       (SELECT count(*) FROM public.profiles) AS profiles_visible;
UPDATE public.banners SET title=title;
ROLLBACK;
