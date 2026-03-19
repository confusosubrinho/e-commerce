# Referência — Checkout / Stripe + Webhooks (e-commerce)

## Modelo mínimo de dados (ordens)

Um modelo simples que funciona bem com checkout + webhook:

- `orders.id`
- `orders.status`: `draft | pending_payment | paid | canceled | refunded | failed`
- `orders.amount` / `orders.currency`
- `orders.stripe_checkout_session_id` (único)
- `orders.stripe_payment_intent_id` (opcional; único quando existir)
- `orders.user_id` e/ou `orders.tenant_id` (se existir multi-tenant)
- timestamps

Regras:

- `success_url` não altera `status` para `paid`.
- O webhook move `pending_payment -> paid` (ou `failed/refunded`).

## Eventos do Stripe (práticos)

Escolha um conjunto pequeno e consistente:

- **`checkout.session.completed`**: bom gatilho para “pagamento iniciado/confirmado” dependendo do modo.
- **`payment_intent.succeeded`**: confirmação de pagamento (útil para mapear `payment_intent_id`).
- **`charge.refunded`** (ou eventos de refund/charge): para atualizar `refunded`.
- (Opcional) disputas: `charge.dispute.*`.

Importante: em alguns cenários, **um evento não substitui os outros**. Defina uma regra de negócio: qual evento finaliza o pedido.

## Idempotência (obrigatório)

Faça uma destas opções:

### Opção 1) Tabela de “eventos processados”

- `stripe_events(id text primary key, created_at timestamptz default now())`
- No handler:
  - tente inserir o `event.id`
  - se já existir: retorne 200 sem reprocessar

### Opção 2) Atualização por chave única

Atualize `orders` usando chaves únicas (ex.: `stripe_checkout_session_id`) e só mude status se a transição for válida:

- `pending_payment -> paid`
- `paid -> refunded`
- Nunca voltar de `paid` para `pending_payment`

## Segurança de webhook (obrigatório)

- Validar assinatura (`STRIPE_WEBHOOK_SECRET`)
- Usar corpo “raw” (sem parse prematuro) antes de validar
- Responder rápido (200/4xx) e evitar lógica pesada no request
- Não depender de `success_url` para consistência

## Supabase / RLS (nota)

- Se o webhook precisar gravar em tabelas com RLS:
  - use Service Role em ambiente server-side controlado (Next.js API) **ou**
  - na Edge Function, use as secrets do Supabase
- Mesmo com Service Role, mantenha validações por `tenant_id`/ownership no código quando necessário.

## Referências externas úteis

- Exemplo oficial do Supabase para webhooks: `https://raw.githubusercontent.com/supabase/supabase/master/examples/edge-functions/supabase/functions/stripe-webhooks/README.md`
- “Loja pronta” (ideias de UX): `https://github.com/top-web-developer/Nextjs-stripe-checkout`
- Vercel Commerce Framework (contexto de hooks/abstração, está arquivado): `https://github.com/vercel/commerce-framework`

