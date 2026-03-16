-- Número do pedido na Yampi (o que aparece no painel da Yampi; ID interno fica em external_reference)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS yampi_order_number text;
COMMENT ON COLUMN public.orders.yampi_order_number IS 'Número do pedido exibido no painel Yampi (ex.: 1491772375818422); external_reference guarda o ID interno da API';
