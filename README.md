# Vanessa Lima Shoes – Plataforma de E-commerce

Plataforma de e-commerce completa para a loja **Vanessa Lima Shoes**, construída com React, Vite, TypeScript, Tailwind CSS e Supabase.

---

## Visão geral

O projeto é composto por:

- **Loja** (storefront): home, listagem de produtos, detalhe de produto, carrinho, checkout, rastreio e conta do cliente.
- **Painel admin**: gestão de produtos, pedidos, clientes, cupons, banners, relatórios, integrações e configurações.
- **Backend serverless**: Supabase Edge Functions (TypeScript/Deno) para checkout, pagamentos, webhooks, integrações externas e tarefas agendadas.

---

## Stack tecnológico

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18 + Vite + TypeScript |
| UI | Tailwind CSS + shadcn-ui + Radix UI |
| Roteamento | React Router DOM v6 |
| Estado/fetch | TanStack Query v5 |
| Formulários | React Hook Form + Zod |
| Gráficos | Recharts |
| Backend/DB | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Edge Functions | TypeScript/Deno (runtime Supabase) |
| Testes unitários | Vitest + Testing Library |
| Testes E2E | Playwright |
| Node mínimo | **Node.js 20+** |
| Gerenciador de pacotes | npm |

### Integrações de pagamento e ERP

| Serviço | Finalidade |
|---------|------------|
| **Stripe** | Checkout embutido/externo/transparente, webhooks |
| **Yampi** | Checkout externo, catálogo, webhooks de pedido |
| **Appmax** | Pagamentos transparentes |
| **Bling** | ERP – sincronização de estoque e pedidos |

---

## Arquitetura de alto nível

```
┌──────────────────────────────────────────────────────┐
│                  FRONTEND (Vite/React)                │
│  src/pages/      – Páginas (loja + admin)             │
│  src/components/ – Componentes UI (store/admin/ui)    │
│  src/hooks/      – Hooks de dados e lógica            │
│  src/lib/        – Utilitários e helpers              │
│  src/types/      – Tipos TypeScript de domínio        │
└────────────────────────┬─────────────────────────────┘
                         │ fetch / supabase-js
┌────────────────────────▼─────────────────────────────┐
│                   SUPABASE                            │
│  Postgres DB     – Produtos, pedidos, integrações     │
│  Auth            – Autenticação de admin e cliente    │
│  Storage         – Imagens de produtos e banners      │
│  Edge Functions  – Checkout, webhooks, cron, SEO      │
└────────────────────────┬─────────────────────────────┘
                         │ API calls
┌────────────────────────▼─────────────────────────────┐
│              INTEGRAÇÕES EXTERNAS                     │
│  Stripe / Yampi / Appmax / Bling / SEO                │
└──────────────────────────────────────────────────────┘
```

Para detalhes completos, veja [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Configuração local

### 1. Pré-requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- Conta no [Supabase](https://supabase.com) com projeto criado

### 2. Clonar e instalar

```bash
git clone <URL_DO_REPOSITORIO>
cd e-commerce
npm install
```

### 3. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha com os valores do seu projeto:

```bash
cp .env.example .env
```

Edite o `.env` com as credenciais reais. Veja `.env.example` para a lista completa de variáveis necessárias.

> **Nunca commite o arquivo `.env` com valores reais.**

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

O app estará disponível em `http://localhost:8080`.

---

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento com hot reload |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build de produção |
| `npm run lint` | Lint com ESLint |
| `npm run typecheck` | Verificação de tipos TypeScript |
| `npm run test` | Testes unitários com Vitest |
| `npm run test:watch` | Testes em modo watch |
| `npm run test:e2e` | Testes E2E com Playwright |
| `npm run test:e2e:ui` | Playwright com interface gráfica |
| `npm run qa:ultimate` | Lint + typecheck + testes + E2E |

Para mais detalhes sobre testes, veja [`docs/TESTING.md`](docs/TESTING.md).

---

## Estrutura de pastas

```
e-commerce/
├── src/
│   ├── pages/
│   │   ├── admin/       – Páginas do painel admin
│   │   └── *.tsx        – Páginas da loja
│   ├── components/
│   │   ├── admin/       – Componentes exclusivos do admin
│   │   ├── store/       – Componentes da loja
│   │   └── ui/          – Componentes base (shadcn-ui)
│   ├── hooks/           – Hooks React de dados e lógica
│   ├── lib/             – Utilitários e helpers
│   └── types/           – Tipos TypeScript de domínio
├── supabase/
│   ├── functions/       – Edge Functions (TypeScript/Deno)
│   │   ├── _shared/     – Helpers compartilhados entre functions
│   │   ├── checkout/    – Funções de checkout e pagamento
│   │   ├── stripe/      – Webhook e integrações Stripe
│   │   ├── yampi/       – Webhook e integrações Yampi
│   │   ├── appmax/      – Webhook e integrações Appmax
│   │   ├── bling/       – Webhook e sync Bling
│   │   ├── seo/         – Geração de SEO, robots, sitemap
│   │   ├── admin/       – Ações administrativas
│   │   └── cron/        – Tarefas agendadas
│   └── migrations/      – Migrations SQL do banco
├── e2e/                 – Testes E2E com Playwright
├── scripts/             – Scripts auxiliares (seed, reconcile, etc.)
├── docs/                – Documentação técnica completa
└── .env.example         – Template de variáveis de ambiente
```

---

## Documentação técnica

| Documento | Conteúdo |
|-----------|----------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Visão completa dos módulos e decisões arquiteturais |
| [`docs/CHECKOUT_FLOW.md`](docs/CHECKOUT_FLOW.md) | Fluxos de checkout por provider |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | Schema do banco de dados |
| [`docs/SUPABASE_CHANGES_PLAN.md`](docs/SUPABASE_CHANGES_PLAN.md) | Como solicitar mudanças no banco à IA |
| [`docs/SUPABASE_CHANGELOG.md`](docs/SUPABASE_CHANGELOG.md) | Histórico de mudanças no banco |
| [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md) | Ambientes dev/staging/produção |
| [`docs/SECURITY_OVERVIEW.md`](docs/SECURITY_OVERVIEW.md) | Segurança, segredos, backup e privacidade |
| [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md) | Métricas, logs e monitoramento |
| [`docs/API_INVENTORY.md`](docs/API_INVENTORY.md) | Inventário de integrações externas |
| [`docs/INTEGRATIONS_GUIDE.md`](docs/INTEGRATIONS_GUIDE.md) | Padrões para integrar serviços externos |
| [`docs/EDGE_FUNCTIONS_GUIDE.md`](docs/EDGE_FUNCTIONS_GUIDE.md) | Padrão de desenvolvimento de Edge Functions |
| [`docs/TESTING.md`](docs/TESTING.md) | Como rodar e escrever testes |
| [`docs/MULTITENANT_DESIGN.md`](docs/MULTITENANT_DESIGN.md) | Design do modelo multi-tenant (fase futura) |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Fases de evolução da plataforma |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Como contribuir, branches e commits |
| [`docs/IMPLEMENTATION_LOG.md`](docs/IMPLEMENTATION_LOG.md) | Log detalhado de todas as mudanças realizadas |

---

## Deploy

O projeto é hospedado via [Lovable](https://lovable.dev). Para publicar, acesse o painel do projeto no Lovable e clique em **Share → Publish**.

Para configurar domínio customizado: **Project → Settings → Domains → Connect Domain**.

---

## Segurança

- Nunca commite `.env` com valores reais.
- Segredos de produção devem ser configurados nas variáveis de ambiente da plataforma (Lovable/Vercel/etc).
- Todas as Edge Functions sensíveis validam autenticação e roles antes de executar.
- Veja [`docs/SECURITY_OVERVIEW.md`](docs/SECURITY_OVERVIEW.md) para mais detalhes.
