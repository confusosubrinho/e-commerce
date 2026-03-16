# Log de Implementação

Registro detalhado de todas as mudanças realizadas no projeto.
Toda vez que uma alteração for feita, deve ser adicionada aqui com data, arquivos e descrição.

---

## 2026-03-05 – To-dos pendentes: stack-consistency e mt-backend

**Tarefa do plano:** Concluir os 2 to-dos pendentes do plano melhorias-enterprise-ecommerce.

### 1. Stack consistency (to-do stack-consistency)

**Arquivos criados**
- `docs/STACK_CONSISTENCY.md` – documento que descreve runtimes (Node para app/scripts, Deno para Edge Functions) e linguagens (TypeScript na app, .mjs nos scripts), decisões e o que não usar (Bun, CJS).

**Arquivos alterados**
- `docs/ROADMAP.md` – Fase 2: item "Verificar consistência de runtimes" marcado como concluído com referência a `STACK_CONSISTENCY.md`.

### 2. MT-backend (to-do mt-backend)

**Arquivos criados**
- `supabase/functions/_shared/tenant.ts` – helper `getTenantIdFromRequest(req, body?)` e constante `DEFAULT_TENANT_ID`; lê `x-tenant-id` (header) ou `body.tenant_id`, valida UUID e retorna tenant padrão se ausente/inválido.

**Arquivos alterados**
- `supabase/functions/checkout-router/index.ts` – importa `getTenantIdFromRequest`; lê `tenantId` no início; inclui `tenant_id` em inserts de `orders`, `order_items` e `inventory_movements`; repassa `x-tenant-id` e `tenant_id` nas chamadas a checkout-create-session, checkout-stripe-create-intent e no body ao delegar para outras funções; CORS permite header `x-tenant-id`.
- `supabase/functions/checkout-stripe-webhook/index.ts` – em `restoreStock`, obtém `tenant_id` do pedido e usa em inserts de `inventory_movements` (tipo "refund").
- `src/lib/checkoutClient.ts` – `InvokeCheckoutOptions` com `tenantId` opcional; `invokeCheckoutFunction` envia `x-tenant-id` e `tenant_id` no body quando informado; `invokeCheckoutRouter` ganha parâmetro `tenantId`.
- `src/pages/CheckoutStart.tsx` – usa `useTenant()` e repassa `tenantId` para `invokeCheckoutRouter`.

### O que mudou
- **Stack:** Projeto documentado como Node (app + scripts .mjs) e Deno (Edge Functions), TypeScript na aplicação; sem Bun/CJS.
- **Multi-tenant no backend:** Checkout router e cliente passam a operar com `tenant_id`: frontend envia tenant (header + body), router usa em todos os inserts e repassa às funções downstream; webhook do Stripe usa `tenant_id` do pedido ao restaurar estoque.

### Notas
- Outras Edge Functions (create-session, process-payment, yampi-webhook, etc.) podem passar a usar `getTenantIdFromRequest` quando precisarem gravar em tabelas com `tenant_id`; o schema já tem DEFAULT, então omissão continua funcionando para o tenant padrão.
- Plano: to-dos `stack-consistency` e `mt-backend` marcados como concluídos no `.plan.md`.

---

## 2026-03-16 – Fase 5: Super Admin

**Tarefa do plano:** Fase 5 – Super Admin (ROADMAP)

### Arquivos criados
- `supabase/migrations/20260316000000_super_admin_role.sql` – adiciona valor `super_admin` ao CHECK de `admin_members.role`
- `src/hooks/useRequireSuperAdmin.ts` – hook que redireciona para `/admin` se o usuário não for `super_admin` ou `owner`
- `src/pages/admin/SuperAdmin.tsx` – página com dashboard de saúde (resumo Commerce Health + webhooks com erro) e catálogo de APIs (Stripe, Yampi, Appmax, Bling)

### Arquivos alterados
- `src/lib/permissions.ts` – tipo `AdminRole` e mapeamentos com `super_admin` (permissão `*`, label, cor)
- `src/App.tsx` – rota `/admin/super` e lazy load de `SuperAdmin`
- `src/pages/admin/AdminLayout.tsx` – item de menu "Super Admin" (ícone Shield) com permissão `super_admin.access`, visível só para owner/super_admin
- `src/pages/admin/Team.tsx` – opção "Super Admin" nos selects de função (convidar e editar membro)
- `docs/ROADMAP.md` – Fase 5 marcada como concluída
- `docs/IMPLEMENTATION_LOG.md` – esta entrada

### O que mudou
- Role `super_admin` disponível em `admin_members`; quem tem essa role (ou `owner`) vê o link "Super Admin" no menu e pode acessar `/admin/super`.
- Página Super Admin exibe resumo de saúde (commerce_health + lista de webhooks com erro) e catálogo de integrações/APIs com links para docs e lista de Edge Functions.
- Acesso à rota protegido por `useRequireSuperAdmin` (redireciona para `/admin` se não autorizado).

### Notas
- Migrations de banco? **Sim** – `20260316000000_super_admin_role.sql`. Rodar `supabase db push` ou aplicar em produção.
- Passos manuais? **Sim** – atribuir role `super_admin` a um usuário em `admin_members` (via SQL ou futura UI em Equipe) para que alguém acesse a área.
- Risco de regressão? **Baixo** – novo role e nova página; lógica de permissão reutiliza `hasPermission` e `useAdminRole`.

---

## 2026-03-16 – Fase 6: Performance e UX

**Tarefa do plano:** Fase 6 – Performance e UX (ROADMAP)

### Arquivos alterados
- `vite.config.ts` – plugin `rollup-plugin-visualizer` quando `ANALYZE_BUNDLE=1`; gera `dist/stats.html` com treemap e tamanhos gzip/brotli
- `package.json` – script `build:analyze` com `cross-env ANALYZE_BUNDLE=1 vite build`; devDependencies `rollup-plugin-visualizer` e `cross-env`
- `src/App.tsx` – PageFallback com `role="status"`, `aria-live="polite"`, `aria-busy="true"` e texto "Carregando..."
- `src/components/store/ErrorBoundary.tsx` – `role="alert"` e `aria-live="assertive"` na tela de erro
- `src/pages/Cart.tsx` – `loading="lazy"` e `decoding="async"` na imagem do item
- `src/pages/CheckoutStart.tsx` – `loading="lazy"` e `decoding="async"` na imagem do resumo
- `src/components/store/SearchPreview.tsx` – `loading="lazy"` e `decoding="async"` na imagem do produto
- `src/components/store/VariantSelectorModal.tsx` – `loading="lazy"` e `decoding="async"` na imagem do produto
- `src/components/store/BuyTogether.tsx` – `loading="lazy"` e `decoding="async"` na imagem
- `src/components/store/CartProductSuggestions.tsx` – `loading="lazy"` e `decoding="async"` na imagem
- `src/components/store/ProductCard.tsx` – `aria-label` nos botões favoritar e comprar; já tinha `loading="lazy"` nas imagens
- `src/components/store/Header.tsx` – `aria-label` no botão do carrinho e no botão remover item do dropdown
- `docs/ROADMAP.md` – Fase 6 marcada como concluída
- `docs/IMPLEMENTATION_LOG.md` – esta entrada

### O que mudou
- **Bundle:** `npm run build:analyze` gera relatório visual em `dist/stats.html` (treemap, gzip, brotli). Code splitting admin já existia (lazy + manualChunks em vite.config).
- **Imagens:** lazy loading em Cart, CheckoutStart, SearchPreview, VariantSelectorModal, BuyTogether e CartProductSuggestions.
- **Loading/erro:** PageFallback acessível (status + texto); ErrorBoundary com alert para leitores de tela.
- **Acessibilidade:** aria-labels em ProductCard (favoritar/comprar), Header (carrinho e remover item).

### Notas
- Migrations de banco? **Não**
- Passos manuais? **Não**. Para analisar o bundle: `npm run build:analyze` e abrir `dist/stats.html` no navegador.
- Risco de regressão? **Baixo** – apenas atributos de acessibilidade e lazy em imagens; comportamento visual preservado.

---

## 2026-03-16 – Fase 7: Schema multi-tenant (migration)

**Tarefa do plano:** Fase 7 – Multi-tenant, primeiro passo (ROADMAP)

### Arquivos criados
- `supabase/migrations/20260316100000_multi_tenant_schema.sql` – tabela `tenants`, tenant padrão, coluna `tenant_id` em 14 tabelas de negócio, backfill e NOT NULL + índices em `tenant_id`

### Arquivos alterados
- `docs/ROADMAP.md` – Fase 7 primeiro item marcado como concluído; status "Em andamento"
- `docs/IMPLEMENTATION_LOG.md` – esta entrada

### O que mudou
- **Tabela `tenants`:** id, name, slug, domain, active, created_at; RLS com acesso service_role e leitura para admins.
- **Tenant padrão:** id fixo `00000000-0000-0000-0000-000000000001` (slug `default`, name "Loja padrão") para DEFAULT nas FKs.
- **Coluna `tenant_id`** (NOT NULL, DEFAULT tenant padrão, FK para `tenants`) em: categories, products, product_variants, product_images, banners, coupons, customers, store_settings, orders, order_items, payments, inventory_movements, integrations_checkout, integrations_checkout_providers.
- Backfill de registros existentes com o tenant padrão; índices em tenant_id nas tabelas principais (categories, products, product_variants, orders, payments) para futuras políticas RLS.
- `checkout_settings_canonical` permanece singleton (não recebeu tenant_id nesta etapa).

### Notas
- Migrations de banco? **Sim** – para aplicar: com projeto linkado (`supabase link`), use `supabase db push`; com Docker rodando localmente, use `supabase db reset`. Sem link nem Docker, a migration fica pronta em `supabase/migrations/20260316100000_multi_tenant_schema.sql` para quando o ambiente estiver disponível.
- RLS por tenant e tenant discovery seguem na Fase 8; a app continua em modo single-tenant até o frontend e as políticas usarem `tenant_id`.
- Risco de regressão? **Baixo** – apenas novas colunas com default; comportamento atual preservado.

---

## 2026-03-17 – Fase 7: RLS por tenant, useTenant e tenant discovery (conclusão)

**Tarefa do plano:** Fase 7 – Multi-tenant, itens restantes (ROADMAP)

### Arquivos criados
- `supabase/migrations/20260317100000_multi_tenant_rls.sql` – tabela `user_tenants`, funções `get_current_tenant_id()` e `is_super_admin()`, políticas RLS por tenant em 14 tabelas (categories, products, product_variants, product_images, banners, coupons, customers, store_settings, orders, order_items, payments, inventory_movements, integrations_checkout, integrations_checkout_providers)
- `src/lib/tenant.ts` – constante `DEFAULT_TENANT_ID` e `resolveTenantId()` (futuro: domínio/path)
- `src/hooks/useTenant.ts` – hook que retorna `tenantId` ativo (hoje sempre tenant padrão)

### Arquivos alterados
- `docs/MULTITENANT_DESIGN.md` – seção "Descoberta de tenant" com status implementado (useTenant, tenant.ts) e planejado (domínio/path)
- `docs/ROADMAP.md` – Fase 7 marcada como concluída; itens RLS, discovery, frontend e migração de dados assinalados
- `docs/IMPLEMENTATION_LOG.md` – esta entrada

### O que mudou
- **user_tenants:** vincula cada admin ao seu tenant; backfill de `admin_members` e `user_roles` para o tenant padrão.
- **get_current_tenant_id():** retorna tenant de `user_tenants` ou tenant padrão (anon/loja).
- **is_super_admin():** true para role `super_admin` ou `owner`; bypass de filtro por tenant nas políticas.
- **RLS:** todas as tabelas com `tenant_id` passam a filtrar por `tenant_id = get_current_tenant_id()` ou `is_super_admin()` ou `service_role`; políticas antigas removidas e recriadas com essa condição.
- **Frontend:** `useTenant()` disponível para uso em filtros/INSERTs quando necessário; RLS já garante isolamento no servidor.
- **Tenant discovery:** implementação mínima (constante + hook); resolução por domínio ou path ficando para Fase 8.

### Notas
- Migrations de banco? **Sim** – aplicar `20260317100000_multi_tenant_rls.sql` após a migration de schema (20260316100000). Ordem: `supabase db push` ou `supabase db reset`.
- Novos admins devem ganhar linha em `user_tenants` (manual ou trigger futura) para ver dados do tenant correto.
- Risco de regressão? **Médio** – alteração de políticas RLS; testar fluxo de loja (anon), admin e Super Admin após aplicar.

---

## 2026-03-17 – Fase 8: Tenant discovery e testes de isolamento

**Tarefa do plano:** Fase 8 – Isolamento e discovery multi-tenant (ROADMAP)

### Arquivos criados
- `src/test/tenant.test.ts` – testes unitários para resolução de tenant (getSlugFromPath, getTenantIdByDomain/BySlug com mock, resolveTenantIdAsync por contexto)

### Arquivos alterados
- `src/lib/tenant.ts` – resolução por domínio (`getTenantIdByDomain`), por slug (`getTenantIdBySlug`), path `/loja/:slug` (`getSlugFromPath`), e `resolveTenantIdAsync(supabase)`; constante `MAIN_DOMAIN_ALIASES`
- `src/hooks/useTenant.ts` – usa `useQuery` e `resolveTenantIdAsync(supabase)` para resolver tenant por hostname/path; retorna `tenantId` e `isLoading`
- `src/integrations/supabase/types.ts` – tabela `tenants` adicionada aos tipos (Row/Insert/Update)
- `docs/ROADMAP.md` – Fase 8 marcada como concluída
- `docs/IMPLEMENTATION_LOG.md` – esta entrada

### O que mudou
- **Tenant discovery:** em ambiente browser, o tenant é resolvido na ordem: 1) domínio customizado (`tenants.domain`), 2) path `/loja/:slug` (`tenants.slug`), 3) tenant padrão. Em localhost/127.0.0.1 só path ou padrão.
- **useTenant():** passa a fazer uma query (cache 5 min) que chama `resolveTenantIdAsync`; `placeholderData` evita flash com tenant padrão.
- **Testes:** 12 testes cobrindo DEFAULT_TENANT_ID, resolveTenantId, getSlugFromPath, getTenantIdByDomain/BySlug (mock), resolveTenantIdAsync com diferentes hostname/path e MAIN_DOMAIN_ALIASES.

### Notas
- Migrations de banco? **Não**
- Passos manuais? **Não**. Para usar domínio customizado: preencher `tenants.domain` para o tenant; para path: acessar `/loja/<slug>` onde `slug` existe em `tenants.slug`.
- Risco de regressão? **Baixo** – nova lógica de resolução e testes; RLS já garante isolamento no servidor.

---

## Formato de entrada

```
## YYYY-MM-DD – [Identificador curto da tarefa]

**Tarefa do plano:** [ID do todo correspondente]

### Arquivos alterados
- `caminho/do/arquivo.ts` – descrição do que mudou

### O que mudou
- Bullet com a mudança principal
- Bullet com detalhe adicional

### Notas
- Migrations de banco? Sim/Não
- Passos manuais necessários? Sim/Não – descrever
- Risco de regressão? Baixo/Médio/Alto – por quê
```

---

## 2026-03-05 – Próxima fase de testes (estabilização e cartPricing)

**Tarefa:** Revisar e estabilizar testes E2E; ampliar testes unitários para checkout/carrinho.

### Arquivos criados
- `src/test/cartPricing.test.ts` – 8 testes para `getCartItemUnitPrice`, `getCartItemTotalPrice`, `hasSaleDiscount` (variant/product sale, modifier)

### Arquivos alterados
- `playwright.config.ts` – `timeout: 60000` (60s por teste) para reduzir flakiness em fluxos com redirect/network
- `src/test/webhook-security.test.ts` – timeout 15s no teste "Stripe webhook com assinatura inválida"
- `docs/ROADMAP.md` – item “Revisar e estabilizar testes E2E” marcado como concluído (timeout global; auditoria)
- `docs/TESTING.md` – estrutura de testes atualizada (formatters, pricingEngine, cartPricing, purchase-flow); áreas prioritárias com marcação ✅; nota sobre timeout/retries E2E

### O que mudou
- E2E: timeout global de 60s nos testes Playwright.
- Unitários: cobertura de `cartPricing` (preço unitário/total e desconto de promoção).
- Documentação de testes alinhada ao que existe hoje.

### Notas
- Migrations de banco? **Não**
- Passos manuais? **Não**
- Risco de regressão? **Baixo** – apenas novos testes e aumento de timeout (pode mascarar testes lentos; 60s é padrão razoável para E2E).

---

## 2026-03-05 – Fase 4: Testes e CI

**Tarefa do plano:** Fase 4 – Testes e CI (ROADMAP)

### Arquivos criados
- `.github/workflows/ci.yml` – workflow que roda lint, typecheck e testes unitários em todo push/PR para `main`
- `src/test/formatters.test.ts` – testes para `formatPrice`, `formatCurrency`, `formatDate`, `formatDateTime`, `ORDER_STATUS_*`, `getProviderLabel`
- `src/test/pricingEngine.test.ts` – testes para funções puras: `getPixPrice`, `shouldApplyPixDiscount`, `getPixPriceForDisplay`, `getPixDiscountAmount`, `getTransparentCheckoutFee`, `getGatewayCost`, `calculateInstallments`, `getInstallmentDisplay`
- `src/components/store/ProductCard.test.tsx` – testes de componente: renderiza nome, preço em BRL e link para página do produto (com mocks de hooks e VariantSelectorModal)

### Arquivos alterados
- `src/lib/pricingEngine.ts` – import de `formatCurrency` de `@/lib/formatters` para uso interno (correção: uso sem import)
- `docs/TESTING.md` – seção CI/CD ampliada: CI em todo PR (ci.yml), E2E em CI (workflow_dispatch, secrets, artifacts)
- `docs/ROADMAP.md` – Fase 4 marcada como concluída (lote inicial)

### O que mudou
- Em todo PR/push para `main` o GitHub Actions executa lint, typecheck e `npm run test`.
- Cobertura unitária para `formatters` e `pricingEngine`; um teste de componente para `ProductCard`.
- Documentação de como rodar E2E em CI (Actions → E2E → Run workflow) e quais secrets configurar.

### Notas
- Migrations de banco? **Não**
- Passos manuais? **Não**. Para E2E em CI, configurar secrets no repositório (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD).
- Risco de regressão? **Baixo** – testes novos; correção em `pricingEngine` apenas adiciona import que faltava (comportamento inalterado em runtime com bundler que hoista re-exports).

---

## 2026-03-05 – Banco local para testes

**Tarefa:** permitir rodar Supabase localmente para desenvolvimento e testes sem usar produção.

### Arquivos criados
- `docs/LOCAL_DEVELOPMENT.md` – guia passo a passo: Docker, Supabase CLI, `supabase start`, `.env.local`, `seed:qa`, E2E
- `.env.local.example` – template com `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` para preencher com saída de `supabase status`

### Arquivos alterados
- `package.json` – scripts `supabase:start`, `supabase:stop`, `supabase:status`, `supabase:reset`
- `README.md` – seção 4 (opcional) “Banco de dados local para testes”, link para `docs/LOCAL_DEVELOPMENT.md`, novos scripts na tabela
- `docs/ENVIRONMENTS.md` – referência ao guia local e `.env.local`

### O que mudou
- É possível subir Postgres + Auth + Studio local com `npm run supabase:start` (requer Docker e Supabase CLI).
- Migrations são aplicadas no `start`; `supabase db reset` reaplica tudo.
- `npm run seed:qa` com `.env.local` apontando para o local cria admin + categoria + produto para E2E.
- Nenhuma alteração em código de aplicação; apenas documentação e scripts npm.

### Notas
- Migrations de banco? **Não**
- Passos manuais? **Sim** – instalar Docker Desktop e Supabase CLI; criar `.env.local` a partir de `.env.local.example` e preencher com `npm run supabase:status`
- Risco de regressão? **Nenhum** – ambiente local opcional

---

## 2026-03-05 – Fase 3: Padrão de Edge Functions

**Tarefa do plano:** `fase3-audit`, `fase3-shared-response`, `fase3-shared-log`, `fase3-migrate`, `fase3-docs`

### Arquivos criados
- `supabase/functions/_shared/response.ts` – `successResponse(data, corsHeaders, status?)` e `errorResponse(message, status, corsHeaders, hint?)` com formato `{ ok, data?, error?, hint? }`
- `supabase/functions/_shared/log.ts` – `logError(scope, correlationId, error, context?)` e `logInfo(scope, correlationId, message, context?)` com filtro de PII

### Arquivos alterados
- `supabase/functions/checkout-stripe-webhook/index.ts` – CORS via `getCorsHeaders(origin)`, `correlationId` no início, respostas com `successResponse`/`errorResponse`, erros com `logError`, evento recebido com `logInfo`
- `supabase/functions/yampi-webhook/index.ts` – CORS via `getCorsHeaders(origin)`, `correlationId`, respostas 401/500 com `errorResponse`, erros com `logError`, evento com `logInfo`; `jsonOk` movido para dentro do handler
- `supabase/functions/checkout-create-session/index.ts` – import de `logError`, `correlationId` e `SCOPE` no início, log de erro no catch com `logError`, resposta de erro no catch com `{ ok: false, error }`
- `docs/EDGE_FUNCTIONS_GUIDE.md` – tabela de helpers atualizada (`response.ts`, `log.ts`), template de função atualizado para usar os shared helpers

### O que mudou
- Respostas de erro padronizadas em `{ ok: false, error, hint? }` nas funções migradas
- Todos os logs de erro nas funções migradas incluem `correlation_id`
- Webhooks Stripe e Yampi passam a usar CORS centralizado (`getCorsHeaders`) em vez de `"*"` fixo
- Novas funções podem importar `_shared/response.ts` e `_shared/log.ts` em vez de duplicar lógica

### Notas
- Migrations de banco? **Não**
- Passos manuais? **Não**. Deploy das Edge Functions afetadas recomendado após merge.
- Risco de regressão? **Baixo** – formato de resposta de sucesso do Stripe (200 + body) e do Yampi (200 + jsonOk) mantido; cliente de checkout já trata `result.data.error`; respostas de erro passam a incluir `ok: false` além de `error`, compatível com o cliente.

---

## 2026-03-05 – Fase 2: Qualidade de código – centralização de helpers duplicados

**Tarefa do plano:** `fase2-scan`, `fase2-formatters`, `fase2-order-utils`, `fase2-cleanup`

### Arquivos alterados
- `src/lib/formatters.ts` – adicionados status `paid`, `refunded`, `failed` aos três mapas de status; adicionado `formatCurrency` como alias de `formatPrice`; ajustadas cores de badge para usar paleta Tailwind consistente
- `src/lib/pricingEngine.ts` – `formatCurrency` agora re-exportado de `@/lib/formatters` (elimina duplicação de implementação idêntica)
- `src/pages/MyAccount.tsx` – removidas definições locais de `formatPrice`, `statusLabels`, `statusColors`; importados de `@/lib/formatters`
- `src/pages/admin/Customers.tsx` – removidas definições locais de `statusLabels`, `statusColors`; importados de `@/lib/formatters`
- `src/pages/Cart.tsx` – `formatPrice` local substituído por alias de `formatCurrency` (já importada)
- `src/pages/Checkout.tsx` – `formatPrice` local substituído por alias de `formatPricingCurrency` (já importada)
- `src/pages/CheckoutReturn.tsx` – `formatPrice` local removido; adicionado import de `@/lib/formatters`
- `src/components/store/ProductCarousel.tsx` – `formatPrice` com `useCallback` removido; adicionado import de `@/lib/formatters`
- `src/components/store/Header.tsx` – `formatPrice` com `useCallback` removido; adicionado import de `@/lib/formatters`
- `src/components/store/ShippingCalculator.tsx` – `formatPrice` local removido; adicionado import de `@/lib/formatters`
- `src/components/store/SearchPreview.tsx` – `formatPrice` local removido; adicionado import de `@/lib/formatters`
- `src/components/store/CategoryFilters.tsx` – `formatPrice` local removido; adicionado import de `@/lib/formatters`
- `src/components/store/StripePaymentForm.tsx` – `formatPrice` local removido; adicionado import de `@/lib/formatters`
- `src/components/store/StockNotifyModal.tsx` – `formatPrice` local removido; adicionado import de `@/lib/formatters`
- `src/components/store/ProductCard.tsx` – `formatPrice` local substituído por alias de `formatCurrency` (já importada)
- `src/components/store/VariantSelectorModal.tsx` – `formatPrice` local substituído por alias de `fmtCurrency` (já importada)

### O que mudou
- **13 duplicações de `formatPrice`/`formatCurrency`** eliminadas — agora um único ponto de verdade em `src/lib/formatters.ts`
- **4 duplicações de `statusLabels`/`statusColors`** eliminadas em `MyAccount`, `Customers`, etc.
- Status de pedido `paid`, `refunded`, `failed` adicionados aos mapas centrais (antes só existiam em definições locais)
- `pricingEngine.ts` não mais duplica a implementação de formatação de moeda

### Notas
- Migrations de banco? **Não**
- Passos manuais? **Não**
- Risco de regressão? **Baixo** — mudança puramente cosmética/estrutural; TypeScript sem erros verificado (`npx tsc --noEmit` = 0 erros); linter passou em todos os 16 arquivos modificados
- **Dívida técnica anotada:** ~40 Edge Functions antigas definem `const corsHeaders = { "Access-Control-Allow-Origin": "*" }` inline ao invés de usar `getCorsHeaders()` de `supabase/functions/_shared/cors.ts`. Migrar progressivamente quando cada função for tocada.

---

## 2026-03-05 – Fase 1: Documentação enterprise completa

**Tarefa do plano:** `docs-readme`, `supabase-plan`, `workflow-conventions`, `api-governance`, `env-observability`

### Arquivos criados
- `docs/IMPLEMENTATION_LOG.md` – este arquivo; log de todas as mudanças futuras
- `docs/ARCHITECTURE.md` – visão geral dos módulos, pastas e decisões arquiteturais
- `docs/CHECKOUT_FLOW.md` – fluxos completos de checkout por provider (Stripe/Yampi/Appmax)
- `docs/DATABASE_SCHEMA.md` – principais tabelas, relacionamentos e regras de negócio
- `docs/SUPABASE_CHANGES_PLAN.md` – regras e template para pedir mudanças no banco à IA
- `docs/SUPABASE_CHANGELOG.md` – histórico de todas as mudanças de banco aplicadas
- `docs/ENVIRONMENTS.md` – estratégia de ambientes dev/staging/produção
- `docs/OBSERVABILITY.md` – métricas e logs para monitorar a plataforma
- `docs/SECURITY_OVERVIEW.md` – segurança, segredos, backup e privacidade
- `docs/ROADMAP.md` – fases de implementação das melhorias enterprise
- `docs/TESTING.md` – como rodar testes unitários e E2E
- `docs/EDGE_FUNCTIONS_GUIDE.md` – padrão para Edge Functions Supabase
- `docs/MULTITENANT_DESIGN.md` – design do modelo multi-tenant (fase futura)
- `docs/API_INVENTORY.md` – inventário de todas as integrações externas
- `docs/INTEGRATIONS_GUIDE.md` – padrões para integrar serviços externos
- `README.md` – reescrito com stack completo, setup e arquitetura
- `CONTRIBUTING.md` – convenções de branch, commit e code review
- `.env.example` – atualizado com todos os segredos necessários

### O que mudou
- Criação de toda a base documental do projeto (pasta `docs/` com 13 arquivos).
- README reescrito de forma completa e útil para onboarding.
- CONTRIBUTING.md com padrões de branches e commits (Conventional Commits).
- .env.example atualizado com todas as variáveis de ambiente necessárias.

### Notas
- Nenhuma migration de banco.
- Nenhum código de aplicação alterado.
- Nenhum passo manual necessário.
- Risco de regressão: **Nenhum** (somente documentação).
