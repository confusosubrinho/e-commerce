# Referência — Stripe Sync (espelho no Postgres)

## O que “sincronizar” (escopo recomendado)

Para SaaS/e-commerce, normalmente basta cobrir:

- **customers**
- **subscriptions**
- **invoices**
- **payment_intents**
- **charges**
- **refunds**
- (opcional) disputes, credit_notes

Evite tentar “espelhar tudo” de primeira. Comece pelos objetos que dirigem receita e suporte.

## Modelagem no banco (padrão)

### 1) Schema dedicado `stripe`

Use um schema dedicado (`stripe`) para deixar claro que:

- é um **mirror externo** (não é a fonte de verdade do seu domínio)
- pode mudar conforme evolução do Stripe / lib

### 2) Tabelas do mirror

Regras simples (muito eficazes):

- **PK = `id` do Stripe** (`text`)
- `created` e `livemode` sempre presentes quando fizer sentido
- `data` em `jsonb` (quando você não quer materializar todos os campos)
- **colunas materializadas** só para filtros/join comuns (ex.: `customer_id`, `status`, `current_period_end`)

### 3) Tabela de idempotência / auditoria

Uma tabela mínima para evitar reprocessamento:

- `event_id text primary key`
- `event_type text not null`
- `received_at timestamptz default now()`
- `stripe_created_at timestamptz null` (derivado de `event.created`)
- `object_id text null`
- `payload jsonb not null` (opcional, mas ótimo para auditoria/debug)
- índices em `received_at`, `event_type`, `object_id`

## Idempotência e transação

Padrão preferido:

1. Iniciar transação
2. `insert into ... (event_id, ...) values (...)`
3. Se conflitou (já existe), **retornar 200/202** e parar
4. Executar upserts/deletes do mirror
5. Commit

Isso garante que:

- o mesmo evento não “quebra” seu estado
- você tem rastreabilidade do que aconteceu

## Revalidação (quando webhooks não bastam)

Há cenários práticos onde “aplicar o delta do evento” não é suficiente:

- eventos fora de ordem
- múltiplos eventos com timestamp igual para o mesmo objeto
- trocas rápidas de plano / trial / cancelamento

Padrão:

- Em eventos críticos (ex.: `customer.subscription.updated`), você pode optar por **revalidar**:
  - chamar a API do Stripe e buscar o objeto atual (e, se necessário, expandir relações)
  - persistir o snapshot “mais recente”

Isso reduz inconsistência ao custo de mais chamadas à API. Use como “escape hatch”, não como default para tudo.

## Backfill / Replay

Mesmo com webhooks, você precisa de um plano para:

- reconstruir o mirror em um novo ambiente
- corrigir perda de eventos
- aplicar mudanças de schema

Estratégias comuns:

- **backfill por janela de tempo**: listar objetos do Stripe (ex.: invoices do último mês) e upsert no banco
- **replay por objeto**: dado `subscription_id`, buscar via API e upsert
- **replay por evento** (menos comum): reprocessar `payload` salvo (se você persistir)

Mantenha o backfill como um comando job/script com logs e limites (rate limit).

## Uso no Lovable / Next.js

Padrão de desenho (sem copiar):

- `stripe` schema: mirror
- `public` schema: domínio do app
- Webhook:
  - valida assinatura
  - idempotência
  - upsert mirror
  - atualiza projeções internas (opcional)

## Armadilhas frequentes

- **Parse do body antes de validar assinatura**: invalida a checagem. Sempre use corpo raw.
- **Confiar em `success_url`/client**: UX não substitui webhook.
- **Não ter backfill**: em algum momento você vai precisar.
- **Misturar mirror e regras internas**: vira acoplamento e dificulta manutenção/migração.

