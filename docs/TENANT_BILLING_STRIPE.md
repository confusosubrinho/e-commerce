# Billing dos Lojistas (Stripe Billing)

Cobrança de assinaturas dos tenants (lojistas) via Stripe Billing. O checkout do consumidor final continua usando o fluxo existente (Checkout Session / Payment Intent); este documento trata apenas da **cobrança da plataforma aos lojistas**.

---

## Visão geral

- **Modelo:** Stripe Subscriptions (Products + Prices no Stripe Dashboard).
- **Webhook:** mesmos eventos no endpoint já usado para checkout (`checkout-stripe-webhook`). Eventos de assinatura: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
- **Banco:** tabela `tenant_plans`, colunas de billing em `tenants` (ver migration `20260319100000_tenant_billing_schema.sql`).

---

## Variáveis de ambiente

| Variável | Onde | Descrição |
|----------|------|-----------|
| `STRIPE_SECRET_KEY` | Edge Function (e Supabase secrets) | Chave secreta da conta Stripe (usada para criar Customers e Subscriptions). |
| `STRIPE_WEBHOOK_SECRET` | Edge Function | Secret do webhook que recebe **tanto** eventos de checkout **quanto** de assinatura. |

Não é necessário um segundo webhook: configure um único endpoint no Stripe e assine com um único `STRIPE_WEBHOOK_SECRET`. O handler distingue por `event.type`.

---

## Passos no Stripe Dashboard

### 1. Criar Products e Prices (planos)

1. Acesse [Stripe Dashboard → Products](https://dashboard.stripe.com/products).
2. Crie um produto por plano pago, por exemplo:
   - **Starter** – preço mensal e/ou anual.
   - **Pro** – preço mensal e/ou anual.
   - **Enterprise** – preço sob consulta ou preço fixo.
3. Para cada preço, copie o **Price ID** (ex.: `price_1ABC...`).

### 2. Atualizar `tenant_plans` com os Price IDs

No Supabase (SQL ou Admin), atualize as linhas da tabela `tenant_plans`:

```sql
UPDATE public.tenant_plans
SET stripe_price_id_monthly = 'price_XXXX', stripe_price_id_yearly = 'price_YYYY'
WHERE slug = 'starter';

UPDATE public.tenant_plans
SET stripe_price_id_monthly = 'price_ZZZZ', stripe_price_id_yearly = 'price_WWWW'
WHERE slug = 'pro';
```

O plano `free` permanece com `stripe_price_id_*` em `NULL`.

### 3. Webhook

- **URL:** a mesma do checkout (ex.: `https://<project>.supabase.co/functions/v1/checkout-stripe-webhook`).
- **Eventos a assinar:** além dos de checkout, inclua:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- O **Signing secret** desse webhook é o `STRIPE_WEBHOOK_SECRET` usado na Edge Function.

---

## Fluxo de criação de assinatura (lojista)

1. **Criar Stripe Customer** (se o tenant ainda não tiver `stripe_customer_id`):
   - Chamar Stripe API `customers.create` com `metadata: { tenant_id: "<uuid>" }`.
   - Gravar o `id` retornado em `tenants.stripe_customer_id`.

2. **Criar Subscription:**
   - Chamar Stripe API `subscriptions.create` com:
     - `customer`: `tenants.stripe_customer_id`
     - `items: [{ price: tenant_plans.stripe_price_id_monthly }]`
     - `metadata: { tenant_id: "<uuid>" }`
     - `trial_period_days: 14` (opcional).

3. **Webhook** atualiza o tenant:
   - `customer.subscription.created` / `updated`: preenche `stripe_subscription_id`, `plan_id`, `billing_status`, `plan_expires_at`, `trial_ends_at`.
   - `customer.subscription.deleted`: zera assinatura e define plano `free` e `billing_status = 'canceled'`.

---

## Frontend: feature gates

- **Hook:** `usePlanGate('reports_advanced')` → `{ allowed, isLoading, planSlug, billingStatus }`.
- **Helpers:** `canUseFeature(planSlug, 'custom_domain')`, `getPlanLimit(planSlug, 'max_products')` em `src/lib/plans.ts`.
- **Dados do tenant + plano:** `useTenantPlan()` → `{ tenant, planSlug, billingStatus, canUse }`.

---

## Próximos passos (fora do escopo desta fase)

- Edge Function ou Server Action para **criar Stripe Customer + Subscription** no onboarding do lojista.
- Página de **escolha de plano** e redirect para Stripe Checkout (Subscription) ou uso da API de Subscriptions.
- **Stripe Customer Portal** (link para o lojista gerenciar assinatura e forma de pagamento).
- Bloqueio de acesso ao admin quando `billing_status` for `past_due` ou `unpaid` (ex.: banner + redirect para renovar).
