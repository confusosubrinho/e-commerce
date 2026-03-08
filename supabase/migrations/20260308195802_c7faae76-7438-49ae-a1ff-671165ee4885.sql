CREATE OR REPLACE FUNCTION public.notify_new_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, link, metadata)
  VALUES (
    'new_review',
    'Nova avaliação recebida',
    NEW.customer_name || ' avaliou um produto com ' || NEW.rating || ' estrelas',
    '/admin/avaliacoes',
    jsonb_build_object('review_id', NEW.id, 'rating', NEW.rating)
  );
  RETURN NEW;
END;
$function$;