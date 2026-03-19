-- Health check SQL (manual) — `orders.status` vs `inventory_movements`
-- Substitua {{ORDER_ID}} por um UUID real antes de executar.
--
-- Retorna, para cada variante do pedido, a soma e contagem de movimentos:
--   reserve / debit / release / refund

WITH items AS (
  SELECT
    oi.product_variant_id,
    oi.quantity
  FROM public.order_items oi
  WHERE oi.order_id = '{{ORDER_ID}}'::uuid
),
orders_row AS (
  SELECT
    o.id,
    o.status,
    o.provider,
    o.gateway,
    o.tenant_id,
    o.transaction_id,
    o.last_webhook_event
  FROM public.orders o
  WHERE o.id = '{{ORDER_ID}}'::uuid
),
moves AS (
  SELECT
    im.variant_id,
    im.type,
    im.quantity
  FROM public.inventory_movements im
  WHERE im.order_id = '{{ORDER_ID}}'::uuid
)
SELECT
  o.id AS order_id,
  o.status,
  o.provider,
  o.gateway,
  o.tenant_id,
  o.transaction_id,
  o.last_webhook_event,
  i.product_variant_id AS variant_id,
  i.quantity AS expected_qty,
  COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'reserve'), 0) AS reserve_qty,
  COUNT(*) FILTER (WHERE m.type = 'reserve') AS reserve_rows,
  COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'debit'), 0) AS debit_qty,
  COUNT(*) FILTER (WHERE m.type = 'debit') AS debit_rows,
  COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'release'), 0) AS release_qty,
  COUNT(*) FILTER (WHERE m.type = 'release') AS release_rows,
  COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'refund'), 0) AS refund_qty,
  COUNT(*) FILTER (WHERE m.type = 'refund') AS refund_rows
FROM orders_row o
JOIN items i ON true
LEFT JOIN moves m ON m.variant_id = i.product_variant_id
GROUP BY
  o.id, o.status, o.provider, o.gateway, o.tenant_id, o.transaction_id, o.last_webhook_event,
  i.product_variant_id, i.quantity
ORDER BY i.product_variant_id;

