BEGIN;
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-media', 'product-media', true);
CREATE POLICY editorial_media_public_read ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'product-media');
CREATE POLICY editorial_media_admin_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-media' AND public.is_admin());
CREATE POLICY editorial_media_admin_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-media' AND public.is_admin())
WITH CHECK (bucket_id = 'product-media' AND public.is_admin());
CREATE POLICY editorial_media_admin_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-media' AND public.is_admin());
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
COMMIT;
