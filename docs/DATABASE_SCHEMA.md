# Schema do Banco de Dados

Visão geral das principais tabelas, relacionamentos e regras de negócio do Postgres (Supabase).

> Para propor mudanças no banco, use o processo descrito em [`SUPABASE_CHANGES_PLAN.md`](SUPABASE_CHANGES_PLAN.md).

---

## Regras gerais de modelagem

- Todos os nomes de tabelas e colunas em **`snake_case`**.
- Toda tabela tem `id` (UUID ou serial) como PK.
- Colunas de data/hora usam `timestamptz` (com timezone).
- Foreign keys sempre explícitas com `REFERENCES`.
- Índices em todas as colunas usadas em `WHERE`, `JOIN` e `ORDER BY` frequentes.
- RLS (Row Level Security) ativo em tabelas com dados sensíveis.

---

## Módulo: Produtos

### `products`
Produto base da loja.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `name` | text | Nome do produto |
| `slug` | text | URL amigável (unique) |
| `description` | text | Descrição longa |
| `short_description` | text | Descrição curta |
| `price` | numeric | Preço base |
| `compare_at_price` | numeric | Preço "de" (riscado) |
| `images` | jsonb | Array de URLs de imagem |
| `category_id` | uuid | FK → categories |
| `active` | boolean | Produto visível na loja |
| `created_at` | timestamptz | – |
| `updated_at` | timestamptz | – |

### `product_variants`
Variações de produto (tamanho, cor, etc.).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `product_id` | UUID | FK → products |
| `sku` | text | SKU interno (unique) |
| `yampi_sku_id` | text | ID da SKU na Yampi |
| `name` | text | Nome da variação (ex.: "P / Azul") |
| `price` | numeric | Preço da variação (sobrescreve produto) |
| `stock` | integer | Estoque atual |
| `attributes` | jsonb | Atributos (tamanho, cor, etc.) |
| `active` | boolean | Variação ativa |
| `created_at` | timestamptz | – |

---

## Módulo: Pedidos

### `orders`
Pedido de compra.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `idempotency_key` | text | Chave de idempotência (cart_id) – UNIQUE |
| `status` | text | `pending`, `paid`, `failed`, `cancelled`, `refunded` |
| `provider` | text | `stripe`, `yampi`, `appmax` |
| `external_reference` | text | ID externo no gateway |
| `yampi_order_number` | text | Número do pedido na Yampi |
| `transaction_id` | text | ID da transação de pagamento |
| `gateway` | text | Nome do gateway (ex.: cartão, pix) |
| `total_amount` | numeric | Valor total do pedido |
| `shipping_amount` | numeric | Valor do frete |
| `customer_name` | text | Nome do cliente |
| `customer_email` | text | Email do cliente |
| `customer_phone` | text | Telefone do cliente |
| `shipping_address` | jsonb | Endereço de entrega |
| `payment_method` | text | Método de pagamento |
| `installments` | integer | Número de parcelas |
| `shipping_method` | text | Método de envio |
| `created_at` | timestamptz | – |
| `updated_at` | timestamptz | – |

**Regra:** `status` nunca regride (não volta de `paid` para `pending`).

### `order_items`
Itens de um pedido.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `order_id` | UUID | FK → orders |
| `product_variant_id` | UUID | FK → product_variants (nullable se sem match local) |
| `quantity` | integer | Quantidade |
| `unit_price` | numeric | Preço unitário no momento da compra |
| `name_snapshot` | text | Nome do produto no momento da compra |
| `sku_snapshot` | text | SKU no momento da compra |
| `image_snapshot` | text | URL da imagem no momento da compra |
| `variant_name` | text | Nome da variação no momento da compra |

### `payments`
Registro de pagamentos (um pedido pode ter múltiplos para estorno/retry).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `order_id` | UUID | FK → orders |
| `provider` | text | `stripe`, `yampi`, `appmax` |
| `transaction_id` | text | ID da transação – UNIQUE(provider, transaction_id) |
| `amount` | numeric | Valor pago |
| `status` | text | `pending`, `paid`, `failed`, `refunded` |
| `created_at` | timestamptz | – |

### `inventory_movements`
Movimentação de estoque.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `product_variant_id` | UUID | FK → product_variants |
| `order_id` | UUID | FK → orders (nullable para ajustes manuais) |
| `quantity` | integer | Negativo = saída, positivo = entrada |
| `reason` | text | `order`, `manual_adjustment`, `return`, etc. |
| `created_at` | timestamptz | – |

---

## Módulo: Integrações / Checkout

### `integrations_checkout`
Configuração geral do checkout.

### `integrations_checkout_providers`
Configuração por provider (Stripe, Yampi, Appmax).

### View `checkout_settings`
View unificada que retorna a configuração ativa de checkout em uma linha: provider ativo, modo (embedded/external/transparent), experience, etc.

### `stripe_webhook_events`
Log de eventos Stripe processados.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `event_id` | text | ID do evento Stripe – UNIQUE |
| `event_type` | text | Tipo do evento |
| `processed_at` | timestamptz | Quando foi processado |
| `error_message` | text | Erro (null = sucesso) |

---

## Dados sensíveis

As seguintes colunas contêm dados pessoais (LGPD/privacidade):

- `orders.customer_name`, `customer_email`, `customer_phone`, `shipping_address`
- Qualquer coluna de perfil de usuário (Supabase Auth)

**Regras:**
- Não logar esses campos em logs de error/debug.
- Não exibir em telas de Super Admin quando não necessário.
- Ver [`SECURITY_OVERVIEW.md`](SECURITY_OVERVIEW.md) para mais detalhes.

---

## Como propor mudanças no banco

Veja [`SUPABASE_CHANGES_PLAN.md`](SUPABASE_CHANGES_PLAN.md) para o processo completo e o template de pedido de mudança.

**Regra de ouro:** toda mudança de banco é feita via migration em `supabase/migrations/`. Nunca editar o schema direto no painel Supabase em produção.
