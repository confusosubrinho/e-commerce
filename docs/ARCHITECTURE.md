# Arquitetura do Sistema

## Visão geral

O projeto é uma plataforma de e-commerce construída como **SPA (Single Page Application)** com backend serverless via Supabase. Não existe servidor Node.js intermediário — o frontend comunica diretamente com Supabase (banco de dados e Edge Functions) via `supabase-js`.

---

## Módulos principais

### 1. Loja (Storefront)

**Localização:** `src/pages/*.tsx`, `src/components/store/`

Responsabilidades:
- Exibição de produtos, categorias, carrosséis, banners.
- Carrinho de compras (localStorage + estado React).
- Checkout multi-provider (Stripe/Yampi/Appmax).
- Conta do cliente (pedidos, favoritos).
- Páginas institucionais (sobre, pagamentos, rastreio, atendimento).

Hooks principais:
- `useHomeSections` / `useHomePageSections` – seções dinâmicas da home.
- `useProducts` – listagem e busca de produtos.
- `usePricingConfig` – configuração de preços e parcelamento.
- `useSiteTheme` – tema visual da loja.
- `useFavorites` – favoritos do cliente.

### 2. Painel Admin

**Localização:** `src/pages/admin/`, `src/components/admin/`

Responsabilidades:
- Gestão de produtos, variações, estoque, imagens, SEO.
- Gestão de pedidos (listagem, detalhes, sync com gateways).
- Gestão de clientes, cupons, avaliações, banners.
- Configurações de checkout, integrações e personalizações.
- Relatórios de vendas, tráfego, carrinhos abandonados.
- Saúde do sistema (webhooks com erro, reconciliação).

Acesso protegido por: `useAdminRole` hook + verificação de role no Supabase.

### 3. Edge Functions (Backend serverless)

**Localização:** `supabase/functions/`
**Runtime:** TypeScript/Deno (runtime Supabase)

Grupos de funções:

| Grupo | Prefixo | Responsabilidade |
|-------|---------|-----------------|
| Checkout | `checkout-*` | Criar sessão, calcular frete, processar pagamento, reconciliar, release reservas, update settings |
| Stripe | `checkout-stripe-*` | Webhook Stripe, criar intent/session, sync catálogo |
| Yampi | `yampi-*` | Webhook, catálogo, importar pedidos, sync status, sync variações/imagens/categorias |
| Appmax | `appmax-*` | Webhook, autorização, healthcheck, geração de merchant keys |
| Bling | `bling-*` | Webhook, OAuth, sync estoque |
| SEO | `seo-*` | Gerar SEO, robots.txt, sitemap.xml |
| Admin | `admin-*` | Ações administrativas, repair de imagens |
| Cron | `cron-*` | Limpeza de logs |
| Integrações | `integrations-*` | Testar conexão, importar Tray |

Helpers compartilhados em `supabase/functions/_shared/`:
- `cors.ts` – headers CORS por origem
- `appmax.ts` – helpers Appmax
- `fetchWithTimeout.ts` – fetch com timeout configurável
- `bling-sync-fields.ts` – mapeamento de campos Bling

### 4. Banco de dados (Supabase Postgres)

**Localização:** `supabase/migrations/`

Principais entidades:
- Produtos: `products`, `product_variants`, `product_images`
- Pedidos: `orders`, `order_items`, `payments`, `inventory_movements`
- Clientes: gerenciados pelo Supabase Auth + perfis
- Integrações: `integrations_checkout`, `integrations_checkout_providers`
- Configurações: settings de loja, tema, banners, seções de home
- Logs: `stripe_webhook_events`, logs de webhook Yampi/Appmax

Para detalhes completos, veja [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md).

---

## Fluxo de dados principal

```
Cliente (browser)
     │
     │ 1. Carrega app (Vite SPA)
     ▼
Frontend React
     │
     │ 2. Query Supabase DB direto (produtos, config, etc.)
     │ 3. Chama Edge Functions para ações (checkout, admin)
     ▼
Supabase
     │
     │ 4. Edge Functions chamam APIs externas
     ▼
APIs externas (Stripe/Yampi/Appmax/Bling)
     │
     │ 5. Retornam eventos via webhooks
     ▼
Edge Functions (webhook handlers)
     │
     │ 6. Atualizam DB
     ▼
Banco Postgres
```

---

## Decisões arquiteturais importantes

### Frontend sem server-side rendering
O projeto usa Vite SPA. SEO é tratado via Edge Functions (`seo-generate`, `seo-sitemap`, `seo-robots`) e React Helmet Async.

### Sem servidor Node intermediário
Toda lógica de backend está em Edge Functions Deno. Isso significa:
- **Não usar `require()`** – somente ESM (`import/export`).
- **Runtime Deno**, não Node. APIs globais como `Deno.env.get()` são usadas nas functions.
- O frontend usa somente `supabase-js` para comunicar com Supabase.

### Estado de carrinho no localStorage
O carrinho é gerenciado em estado React com persistência no localStorage. Não há tabela de "carrinho ativo" no banco – carrinhos abandonados são identificados por eventos de analytics/checkout iniciados.

### Idempotência em pagamentos
Todos os webhooks de pagamento são idempotentes:
- Stripe: `stripe_webhook_events.event_id` UNIQUE
- Yampi: `external_reference` + flag duplicate
- Appmax: `event_hash` UNIQUE

Status de pedido nunca regride (não volta de `paid` para `pending`).

### Configurações via banco
Configurações de checkout, tema, integrações e personalizações são armazenadas no Supabase e lidas dinamicamente. Nenhuma config sensível está hard-coded no frontend.

---

## Padrões de código

### Frontend
- Componentes de UI "puros" em `src/components/` (sem chamadas de API diretas).
- Hooks de dados e lógica de negócio em `src/hooks/`.
- Tipos de domínio centralizados em `src/types/`.
- Utilitários e helpers em `src/lib/`.

### Edge Functions
Estrutura padrão de toda Edge Function – ver [`EDGE_FUNCTIONS_GUIDE.md`](EDGE_FUNCTIONS_GUIDE.md).

---

## Futuro: Multi-tenant

A plataforma está sendo preparada para suportar múltiplas lojas (tenants) isoladas na mesma base técnica. O design está documentado em [`MULTITENANT_DESIGN.md`](MULTITENANT_DESIGN.md).
