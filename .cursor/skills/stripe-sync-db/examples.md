# Exemplos — Stripe ↔ Postgres (sincronização e auditoria)

## Exemplo A: SQL mínimo para idempotência de eventos

```sql
create schema if not exists stripe;

create table if not exists stripe.webhook_events_processed (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  stripe_created_at timestamptz null,
  object_id text null,
  payload jsonb not null
);

create index if not exists webhook_events_processed_received_at_idx
  on stripe.webhook_events_processed (received_at desc);

create index if not exists webhook_events_processed_object_id_idx
  on stripe.webhook_events_processed (object_id);
```

## Exemplo B: Upsert “genérico” de um objeto em JSONB

Útil quando você quer começar rápido e materializar só o essencial.

```sql
create table if not exists stripe.subscriptions (
  id text primary key,
  customer_id text null,
  status text null,
  current_period_end timestamptz null,
  cancel_at_period_end boolean null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists stripe_subscriptions_customer_id_idx
  on stripe.subscriptions (customer_id);
```

Upsert (pseudocódigo: faça o bind dos parâmetros no seu executor):

```sql
insert into stripe.subscriptions (id, customer_id, status, current_period_end, cancel_at_period_end, data)
values ($1, $2, $3, $4, $5, $6)
on conflict (id) do update set
  customer_id = excluded.customer_id,
  status = excluded.status,
  current_period_end = excluded.current_period_end,
  cancel_at_period_end = excluded.cancel_at_period_end,
  data = excluded.data,
  updated_at = now();
```

## Exemplo C: Consulta “assinaturas ativas por cliente”

```sql
select
  s.id as subscription_id,
  s.status,
  s.current_period_end
from stripe.subscriptions s
where s.customer_id = $1
  and s.status in ('active', 'trialing')
order by s.current_period_end desc nulls last;
```

## Exemplo D: Fluxo de webhook (pseudo)

Checklist do handler:

- ler raw body
- validar assinatura
- extrair `event.id`, `event.type`, `event.data.object.id`
- tentar inserir em `stripe.webhook_events_processed`
  - se já existe: retornar 200/202
- upsert no mirror (`stripe.*`)
- (opcional) revalidar via API em eventos críticos

## Exemplo E: Revalidação (quando há risco de ordem)

Heurística comum:

- Eventos: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`
- Se o estado persistido “não bate” com o esperado (ou se você detecta timestamps iguais), buscar o objeto atual via API do Stripe e persistir o snapshot.

