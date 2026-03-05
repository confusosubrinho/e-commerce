-- ID Yampi no item do pedido (vínculo com o SKU da Yampi)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS yampi_sku_id bigint;
COMMENT ON COLUMN public.order_items.yampi_sku_id IS 'ID do SKU na Yampi para este item (vínculo entre pedido e catálogo Yampi)';

-- Data da compra na Yampi (para pedidos importados/sincronizados)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS yampi_created_at timestamptz;
COMMENT ON COLUMN public.orders.yampi_created_at IS 'Data/hora da compra na Yampi (quando importado ou sincronizado)';
