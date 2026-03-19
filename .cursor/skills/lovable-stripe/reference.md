# Referência — Lovable + Stripe

## Fonte (doc oficial)

Esta skill se baseia na documentação do Lovable para Stripe:

- `https://docs.lovable.dev/integrations/stripe`

## Modelo mental (Lovable)

- **Chat-driven setup**: descreva o que quer; a plataforma gera Edge Functions + schema + UI.
- **Supabase como base**: amarra usuário (auth), guarda estados (payments/subscriptions) e aplica RLS.
- **Webhooks são opt-in**: por padrão, o Lovable tende a evitar webhooks e pode usar polling; peça webhooks apenas quando fizer sentido.

## Segurança (não negociável)

- **Segredo do Stripe**:
  - nunca no chat
  - nunca no client
  - evite commitar em `.env` (no seu repo existe `.env` deletado no status — manter assim)
- **RLS**:
  - dados de pagamentos/assinaturas devem respeitar usuário (e tenant, se aplicável)
  - qualquer bypass (service role) só em caminhos controlados (ex.: webhook/edge function)

## Quando pedir webhooks explicitamente

Peça webhooks quando você precisar:

- consistência imediata (ex.: liberar acesso assim que pagar)
- lidar com atualização/cancelamento de assinatura
- confiar em eventos do Stripe como “fonte de verdade” (mais robusto do que depender de redirects)

Eventos recomendados:

- `payment_intent.succeeded` / `payment_intent.payment_failed`
- `customer.subscription.created` / `updated` / `deleted`

## Debug (mapa de logs)

- **Browser**: falhas de redirect, CORS, chamadas para Edge Functions
- **Supabase Edge Functions logs**: erros de secret ausente, payload inválido, falha de update no DB
- **Stripe logs/webhooks**: eventos disparados, tentativas de entrega, falhas de assinatura

## Anti-padrões comuns

- “Funciona no preview?” → **Não**. Precisa deploy.
- “Colei a Secret Key no chat” → **Vaza segredo**. Refazer via Add API Key e revogar chave no Stripe.
- “Marcar como pago no success_url” → success é UX; confirmação real deve vir do backend (polling/webhook).
