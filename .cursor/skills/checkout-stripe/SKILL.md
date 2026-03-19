---
name: checkout-stripe
description: Implementa checkout com Stripe (Checkout Sessions) e confirmações via webhooks, com padrões seguros para Next.js (App Router) e Supabase (Edge Functions/RLS). Use quando o usuário mencionar Stripe, checkout, pagamento, checkout session, webhook, payment_intent, assinatura de webhook, success/cancel, Supabase Edge Functions, ou fluxo de pedidos pago/não pago.
---

# Checkout / Stripe (Next.js + Webhooks + Supabase)

## Objetivo

Entregar um fluxo **transplantável** de checkout com Stripe que seja correto para e-commerce:

- checkout (Stripe Checkout Session) **inicia** a compra
- webhook (Stripe) **confirma** a compra (fonte de verdade)
- banco (Supabase/Postgres) guarda **estado do pedido** e evita inconsistências

## Princípios (obrigatórios)

- **Webhook é a fonte de verdade**: páginas `success`/`cancel` são UX; não “marcam como pago”.
- **Validar assinatura do webhook** com `STRIPE_WEBHOOK_SECRET`.
- **Idempotência**: processe o mesmo evento várias vezes sem corromper estado.
- **Sem segredos no client**: `STRIPE_SECRET_KEY` e Service Role do Supabase só no server.
- **RLS continua valendo**: se precisar bypassar (ex.: webhook), faça isso só no caminho controlado.

## Checklist (faça nessa ordem)

- [ ] Modelar `orders` (mínimo): `status`, `stripe_checkout_session_id`, `stripe_payment_intent_id` (quando aplicável), `amount`, `currency`, `user_id`/`tenant_id` (se existir), timestamps.
- [ ] Criar endpoint server-side para **criar Checkout Session** (Next.js Route Handler / Server Action).
- [ ] Definir URLs de `success_url` e `cancel_url`.
- [ ] Implementar handler de **webhook** (Next.js API route ou Supabase Edge Function):
  - validar assinatura
  - aplicar idempotência
  - atualizar `orders.status` conforme evento
- [ ] Ajustar UI para refletir estados: `loading / error / empty / success`.
- [ ] (Opcional) Suportar reembolso/disputa atualizando status via eventos.

## Fluxos recomendados (decisão)

### 1) Checkout Session (recomendado para storefront)

- Crie uma `Checkout Session` no server.
- Redirecione o usuário para `session.url`.
- Em `success_url`, mostre confirmação e/ou “aguardando confirmação”.
- Marque pedido como **pago** somente quando o webhook chegar.

### 2) Payment Intents (mais controle, mais complexo)

Use quando você precisa de UI de cartão embutida ou múltiplas tentativas no mesmo pedido. Mesmo assim, **webhooks** seguem obrigatórios.

## Integração com Supabase (padrão prático)

- **Frontend**: nunca use Service Role.
- **Webhook**:
  - Se rodar no Next.js: use Service Role no server (com autorização implícita do endpoint) e registre mudanças no banco.
  - Se rodar no Supabase Edge Function: siga o exemplo oficial do Supabase (Stripe webhooks) e configure secrets.

## Recursos

- Exemplos práticos e snippets: veja [examples.md](examples.md)
- Referência (modelo de dados, eventos, idempotência, armadilhas): veja [reference.md](reference.md)

