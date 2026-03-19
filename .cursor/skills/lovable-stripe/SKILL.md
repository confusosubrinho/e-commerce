---
name: lovable-stripe
description: Integra Stripe no Lovable via fluxo chat-driven com Supabase (Edge Functions + RLS), incluindo setup seguro de Secret Key via Add API Key, criação de checkouts (one-time/subscription), webhooks opt-in e troubleshooting. Use quando o usuário mencionar Lovable, lovable.dev, integração Stripe do Lovable, Add API Key, Supabase + Stripe no Lovable, Edge Functions, payment_intent, customer.subscription, ou “Stripe não funciona no preview”.
---

# Lovable + Stripe (Integração oficial)

## Objetivo

Aplicar a integração Stripe **no Lovable**, priorizando o fluxo **chat-driven** (auto-setup), com guardrails de segurança e um checklist de verificação (Supabase, secrets, deploy, logs).

## Princípios (obrigatórios)

- **Nunca colar Stripe Secret Key no chat**: usar o formulário **Add API Key** do Lovable.
- **Supabase conectado é pré-requisito** (Edge Functions + RLS).
- **Stripe não funciona no preview**: testar em ambiente **deployado** e em **Test Mode**.
- **Webhooks são opt-in**: só implementar quando o fluxo exigir confirmação em tempo real/role-based/etc.

## Checklist (faça nessa ordem)

- [ ] Confirmar projeto **conectado ao Supabase**.
- [ ] Adicionar **Stripe Secret Key** via **Add API Key** (sem expor em `.env`/chat).
- [ ] Definir o que será feito:
  - **Pagamento avulso** (one-time checkout)
  - **Assinaturas** (tiers, anual/mensal, etc.)
- [ ] Pedir o setup ao Lovable por chat (ver prompts em [examples.md](examples.md)).
- [ ] Validar o que foi gerado:
  - Edge Functions para criar checkout e (se optado) webhook
  - tabelas no banco + **RLS**
  - UI (botões/fluxo) e estados `loading/error/empty/success`
- [ ] Testar em **Stripe Test Mode** (cartão `4242 4242 4242 4242`) e **app deployado**.

## Quando habilitar Webhooks (opt-in)

Use webhooks quando você precisa de:

- confirmação de pagamento/assinatura como **fonte de verdade**
- controle de acesso por plano (role/tier) e sincronismo mais imediato
- auditoria de eventos (ex.: `customer.subscription.updated`)

Eventos típicos:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Debug rápido (onde olhar)

- **Browser Console** → Network/Errors
- **Supabase** → Edge Functions → Logs
- **Stripe Dashboard** → Logs / Webhooks

## Recursos

- Exemplos de prompts e checklist de teste: [examples.md](examples.md)
- Referência (decisões, webhooks, guardrails, anti-padrões): [reference.md](reference.md)
