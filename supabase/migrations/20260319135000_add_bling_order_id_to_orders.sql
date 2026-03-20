-- Bug 4 — orders.bling_order_id em coluna dedicada

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bling_order_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_orders_bling_order_id
  ON public.orders(bling_order_id)
  WHERE bling_order_id IS NOT NULL;

-- Backfill: extrai o primeiro match de `bling_order_id:<digits>` em notes
UPDATE public.orders
SET bling_order_id = (regexp_match(notes, 'bling_order_id:(\\d+)'))[1]::bigint
WHERE notes LIKE '%bling_order_id:%';

