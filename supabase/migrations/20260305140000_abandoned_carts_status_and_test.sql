-- Status do carrinho abandonado: pending | contacted | recovered
ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'recovered'));

-- Marcação de carrinho de teste (para filtrar e limpar separadamente)
ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

-- Preencher status a partir dos dados existentes
UPDATE public.abandoned_carts
SET status = CASE
  WHEN recovered = true THEN 'recovered'
  WHEN contacted_via IS NOT NULL AND contacted_via != '' THEN 'contacted'
  ELSE 'pending'
END;

-- Índices para filtros
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON public.abandoned_carts(status);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_is_test ON public.abandoned_carts(is_test);

COMMENT ON COLUMN public.abandoned_carts.status IS 'pending = não contatado, contacted = contatado (email/whatsapp), recovered = recuperado';
COMMENT ON COLUMN public.abandoned_carts.is_test IS 'true = carrinho de teste (pode ser filtrado/limpo separadamente)';
