-- Campos para importação Yampi: método de envio, status de pagamento e SKU nos itens
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_method text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text;

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS sku_snapshot text;

COMMENT ON COLUMN public.orders.shipping_method IS 'Método de envio escolhido (ex: Retirar na loja, Correios Pac)';
COMMENT ON COLUMN public.orders.payment_status IS 'Status do pagamento: approved, pending, failed, refunded';
COMMENT ON COLUMN public.order_items.sku_snapshot IS 'SKU do item no momento do pedido (snapshot da Yampi/checkout)';
