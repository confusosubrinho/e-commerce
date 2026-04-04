-- ============================================================
-- Yampi Checkout Sessions + Guarda de Preço
-- Objetivo: congelar valores calculados pelo backend antes de
-- criar o payment link na Yampi, e permitir validação
-- do amount pago contra o valor esperado.
-- ============================================================

-- 1. Tabela checkout_sessions
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                      UUID        REFERENCES public.orders(id) ON DELETE SET NULL,
  tenant_id                     UUID,

  -- Snapshot dos itens no momento do checkout (congelado)
  items                         JSONB       NOT NULL DEFAULT '[]',

  -- Valores calculados e congelados pelo backend
  subtotal                      NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount               NUMERIC(12,2) NOT NULL DEFAULT 0,
  coupon_code                   TEXT,
  coupon_id                     UUID,
  shipping_amount               NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount                  NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Ciclo de vida
  status                        TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',             -- criada, aguardando link Yampi
      'payment_link_created',-- link Yampi criado com sucesso
      'paid',                -- pagamento confirmado e validado
      'expired',             -- sessão expirou sem pagamento
      'payment_inconsistent',-- Yampi cobrou valor diferente do esperado
      'cancelled'            -- cancelado pelo usuário ou sistema
    )),

  -- Preenchido quando amount pago diverge do total_amount congelado
  payment_inconsistency_reason  TEXT,

  -- Rastreabilidade
  yampi_link_id                 TEXT,
  correlation_id                TEXT,

  -- Expiração padrão: 30 minutos
  expires_at                    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_order_id
  ON public.checkout_sessions(order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_expires_pending
  ON public.checkout_sessions(expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status
  ON public.checkout_sessions(status);

-- RLS: apenas service_role acessa diretamente (edge functions usam service role key)
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkout_sessions_service_role_only"
  ON public.checkout_sessions
  FOR ALL
  USING (auth.role() = 'service_role');

-- 2. Coluna payment_status em orders (se não existir)
-- Registra o status de pagamento de forma independente do status do pedido
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT NULL;

-- Comentário de auditoria: valores possíveis para payment_status
COMMENT ON COLUMN public.orders.payment_status IS
  'Status do pagamento: approved | refused | refunded | chargeback | inconsistent | cancelled';

-- 3. Índice para busca por payment_status inconsistente (facilita auditoria)
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders(payment_status)
  WHERE payment_status IS NOT NULL;

-- 4. Função para expirar checkout_sessions automaticamente (usada por cron)
CREATE OR REPLACE FUNCTION public.expire_checkout_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.checkout_sessions
  SET
    status     = 'expired',
    updated_at = NOW()
  WHERE
    status    = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

COMMENT ON FUNCTION public.expire_checkout_sessions() IS
  'Marca checkout_sessions pendentes como expiradas. Deve ser chamada por cron ou TTL job.';
