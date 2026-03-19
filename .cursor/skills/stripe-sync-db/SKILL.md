---
name: stripe-sync-db
description: Sincroniza objetos e eventos do Stripe com Postgres/Supabase (espelho no schema stripe) usando webhooks + idempotência + revalidação/backfill. Use quando o usuário mencionar Stripe Sync Engine (supabase/stripe-sync-engine), sincronização Stripe↔Postgres, webhooks para replicar objetos do Stripe, auditoria de pagamentos/assinaturas, backfill/replay, reconciliação, ou modelagem de tabelas Stripe no banco.
---

# Sincronização Stripe ↔ Banco (Postgres/Supabase)

## Objetivo

Criar uma sincronização **confiável e auditável** entre Stripe e Postgres:

- **Webhooks** atualizam o banco em tempo real (fonte de eventos)
- Um **espelho** dos objetos do Stripe vive em um schema dedicado (ex.: `stripe.*`)
- O app (SaaS/e-commerce) consome esse espelho para **assinaturas, pagamentos, invoices, reembolsos e auditoria**

## Princípios (obrigatórios)

- **Idempotência por `event.id`**: o mesmo evento pode chegar 1..N vezes.
- **Verificação de assinatura** do webhook (`STRIPE_WEBHOOK_SECRET`) sempre.
- **Revalidação quando necessário**: eventos podem chegar fora de ordem ou com timestamps iguais; em casos críticos, busque o objeto mais recente via API do Stripe antes de persistir.
- **Separação de responsabilidades**:
  - `stripe.*` = mirror do Stripe (técnico, “read model” externo)
  - `public.*` (ou seu schema do app) = regras de negócio (orders, subscriptions internas, entitlements, etc.)
- **Sem segredos no client**: `STRIPE_SECRET_KEY` e conexão privilegiada no server/Edge Function.

## Decisão rápida (onde rodar)

Escolha um único “executor” do webhook:

- **Next.js (Route Handler)**: bom quando seu backend já roda em Node e você quer controlar lógica e logs no app.
- **Supabase Edge Function**: bom quando você quer o webhook isolado e próximo do Supabase; útil para infraestrutura mais simples.
- **Worker/Job**: bom quando você quer desacoplar ingestão (rápida) de processamento (mais pesado).

O essencial: **o endpoint de webhook precisa ser rápido** e sempre idempotente.

## Checklist (faça nessa ordem)

- [ ] **Definir estratégia de espelho**:
  - `stripe` schema (recomendado) com tabelas para objetos relevantes (customers, subscriptions, invoices, payment_intents, charges, refunds…)
- [ ] **Criar tabela de controle de eventos** (idempotência + auditoria):
  - ex.: `stripe.webhook_events_processed` com PK `event_id`
- [ ] **Implementar endpoint de webhook**:
  - validar assinatura usando corpo raw
  - registrar evento como processado (ou abortar se já existe)
  - persistir/atualizar objeto(s) no `stripe.*`
  - (opcional) enfileirar “revalidação”/backfill quando necessário
- [ ] **Implementar backfill/replay**:
  - comando job/script que re-sincroniza janelas de tempo (ex.: últimos 30 dias) e/ou objetos específicos
- [ ] **Conectar o app ao espelho**:
  - consultas e views para “estado atual” (assinaturas ativas, faturas em aberto, pagamentos falhos)
  - regras internas derivadas (ex.: `public.entitlements`, `public.orders`, `public.subscription_state`)

## Padrão de sincronização recomendado (alto nível)

1. **Receber webhook**
2. **Validar assinatura**
3. **Idempotência**: inserir `event_id` numa tabela de eventos processados (transação)
4. **Persistir mirror**: upsert no `stripe.*` usando `object.id` como PK
5. **Revalidação (condicional)**:
   - Se o evento for “sensível a ordem” (ex.: subscription update/cancel/trial) e houver risco de inconsistência, buscar o objeto atual via API e persistir esse snapshot
6. **(Opcional) Projetar estado para o domínio do app**:
   - ex.: atualizar `public.subscription_state` e `public.entitlements` com transições válidas

## Recursos

- Exemplos práticos (SQL, webhook, consultas): veja [examples.md](examples.md)
- Referência (modelagem, armadilhas, revalidação/backfill): veja [reference.md](reference.md)
