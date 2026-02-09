
-- Abandoned carts tracking
CREATE TABLE public.abandoned_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID,
  email TEXT,
  phone TEXT,
  customer_name TEXT,
  cart_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  page_url TEXT,
  recovered BOOLEAN DEFAULT false,
  recovered_at TIMESTAMPTZ,
  contacted_via TEXT,
  contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage abandoned carts" ON public.abandoned_carts FOR ALL USING (is_admin());
CREATE POLICY "Anyone can insert abandoned carts" ON public.abandoned_carts FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own abandoned carts" ON public.abandoned_carts FOR SELECT USING (true);

-- UTM/Traffic tracking
CREATE TABLE public.traffic_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  referrer TEXT,
  landing_page TEXT,
  traffic_type TEXT DEFAULT 'direct',
  device_type TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.traffic_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage traffic sessions" ON public.traffic_sessions FOR ALL USING (is_admin());
CREATE POLICY "Anyone can insert traffic sessions" ON public.traffic_sessions FOR INSERT WITH CHECK (true);

-- Email automation queue (prepared for future)
CREATE TABLE public.email_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_type TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  delay_minutes INTEGER DEFAULT 0,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email automations" ON public.email_automations FOR ALL USING (is_admin());

-- Email automation logs
CREATE TABLE public.email_automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID REFERENCES public.email_automations(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email logs" ON public.email_automation_logs FOR ALL USING (is_admin());

-- Insert default email automation templates (inactive until configured)
INSERT INTO public.email_automations (automation_type, trigger_event, delay_minutes, email_subject, email_body, is_active) VALUES
('abandoned_cart', 'cart_abandoned', 60, 'Você esqueceu algo no carrinho! 🛒', '<h1>Ei, {{name}}!</h1><p>Notamos que você deixou alguns itens no carrinho. Volte e finalize sua compra!</p>', false),
('abandoned_cart', 'cart_abandoned', 1440, 'Seus itens ainda estão esperando por você! ⏰', '<h1>{{name}}, não perca!</h1><p>Os itens do seu carrinho podem esgotar. Finalize agora!</p>', false),
('birthday', 'customer_birthday', 0, 'Feliz Aniversário! 🎂 Presente especial para você', '<h1>Parabéns, {{name}}!</h1><p>Preparamos um cupom especial de aniversário para você!</p>', false),
('post_purchase', 'order_delivered', 4320, 'Como foi sua experiência? ⭐', '<h1>Olá, {{name}}!</h1><p>Gostaríamos de saber como foi sua experiência com a compra!</p>', false),
('welcome', 'user_signup', 0, 'Bem-vinda à Vanessa Lima Shoes! 👠', '<h1>Olá, {{name}}!</h1><p>Seja bem-vinda! Preparamos ofertas especiais para sua primeira compra.</p>', false);

-- Add birthday field to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birthday DATE;

-- Updated_at trigger for new tables
CREATE TRIGGER update_abandoned_carts_updated_at BEFORE UPDATE ON public.abandoned_carts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_automations_updated_at BEFORE UPDATE ON public.email_automations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
