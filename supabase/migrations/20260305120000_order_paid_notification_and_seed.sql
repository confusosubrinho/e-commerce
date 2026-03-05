-- Notificação quando pedido é pago (status -> processing)
CREATE OR REPLACE FUNCTION public.notify_order_paid() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'processing' AND (OLD.status IS DISTINCT FROM 'processing') THEN
    INSERT INTO public.admin_notifications (type, title, message, link, metadata)
    VALUES (
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

DROP TRIGGER IF EXISTS on_order_paid ON public.orders;
CREATE TRIGGER on_order_paid
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_paid();

-- Notificações persistentes de exemplo (boas-vindas e dicas) — apenas se ainda não existirem
INSERT INTO public.admin_notifications (type, title, message, link, is_read)
SELECT 'system', 'Bem-vindo ao painel', 'Use as notificações para acompanhar novos pedidos, estoque baixo e avaliações. Clique em uma notificação para ir direto ao recurso.', '/admin/pedidos', false
WHERE NOT EXISTS (SELECT 1 FROM public.admin_notifications WHERE type = 'system' AND title = 'Bem-vindo ao painel' LIMIT 1);
INSERT INTO public.admin_notifications (type, title, message, link, is_read)
SELECT 'system', 'Dica: Pedidos', 'Quando um pedido for pago, você verá uma notificação "Pedido pago" aqui. Acesse Pedidos para ver detalhes e atualizar status.', '/admin/pedidos', false
WHERE NOT EXISTS (SELECT 1 FROM public.admin_notifications WHERE type = 'system' AND title = 'Dica: Pedidos' LIMIT 1);
INSERT INTO public.admin_notifications (type, title, message, link, is_read)
SELECT 'system', 'Carrinhos abandonados', 'Carrinhos abandonados aparecem em Carrinhos Abandonados. Você pode limpar carrinhos de teste com o botão "Limpar todos".', '/admin/carrinhos-abandonados', false
WHERE NOT EXISTS (SELECT 1 FROM public.admin_notifications WHERE type = 'system' AND title = 'Carrinhos abandonados' LIMIT 1);
