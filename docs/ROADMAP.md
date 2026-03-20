# Roadmap de Melhorias Enterprise

Fases de implementação do plano de melhoria da plataforma.

> Para o plano completo e detalhado, ver [`../c:\Users\William\.cursor\plans\melhorias-enterprise-ecommerce_dd1f7809.plan.md`](https://github.com).
> Para o log de mudanças já realizadas, ver [`IMPLEMENTATION_LOG.md`](IMPLEMENTATION_LOG.md).

---

## Fase 1 – Documentação e fundação

**Status:** ✅ Concluída

Objetivo: criar toda a base documental e definir padrões antes de qualquer refatoração de código.

- [x] `README.md` completo e útil
- [x] `docs/ARCHITECTURE.md`
- [x] `docs/CHECKOUT_FLOW.md`
- [x] `docs/DATABASE_SCHEMA.md`
- [x] `docs/SUPABASE_CHANGES_PLAN.md` e `SUPABASE_CHANGELOG.md`
- [x] `docs/ENVIRONMENTS.md`
- [x] `docs/SECURITY_OVERVIEW.md`
- [x] `docs/OBSERVABILITY.md`
- [x] `docs/EDGE_FUNCTIONS_GUIDE.md`
- [x] `docs/TESTING.md`
- [x] `docs/API_INVENTORY.md`
- [x] `docs/INTEGRATIONS_GUIDE.md`
- [x] `docs/MULTITENANT_DESIGN.md`
- [x] `CONTRIBUTING.md`
- [x] `.env.example` atualizado
- [x] `docs/IMPLEMENTATION_LOG.md`

---

## Fase 2 – Qualidade de código e helpers

**Status:** ✅ Concluída

Objetivo: varredura de código morto/duplicado, centralização de helpers e tipos.

- [x] Varredura de arquivos não utilizados e código morto
- [x] Centralizar helpers de formatação em `src/lib/formatters.ts`
- [x] Centralizar helpers de status de pedido (ORDER_STATUS_* em formatters)
- [x] Eliminar duplicações de `formatPrice`/`statusLabels` (13+ arquivos)
- [x] Verificar consistência de runtimes (sem uso inesperado de Bun/CJS) — ver `docs/STACK_CONSISTENCY.md`
- [ ] Eliminar `any` desnecessários no TypeScript (incremental)

---

## Fase 3 – Padrão de Edge Functions

**Status:** ✅ Concluída (lote inicial)

Objetivo: padronizar todas as Edge Functions seguindo `EDGE_FUNCTIONS_GUIDE.md`.

- [x] Auditar Edge Functions (amostra: checkout-create-session, stripe-webhook, yampi-webhook)
- [x] Criar `_shared/response.ts` e `_shared/log.ts`
- [x] Adicionar `correlationId` e logs estruturados nas funções críticas migradas
- [x] Padronizar formato de resposta `{ ok, data?, error?, hint? }` nas funções migradas
- [ ] Migrar progressivamente as demais funções ao usar `getCorsHeaders`, `errorResponse`/`successResponse`, `logError`/`logInfo`

---

## Fase 4 – Testes e CI

**Status:** ✅ Concluída (lote inicial)

Objetivo: fortalecer cobertura de testes e automatizar qualidade no pipeline.

- [x] Testes unitários para funções críticas de negócio (`formatters`, `pricingEngine`)
- [x] Testes de componentes React (ProductCard com mocks)
- [x] Revisar e estabilizar testes E2E existentes (timeout global 60s; auditoria de skips/env)
- [x] Configurar GitHub Actions com lint + typecheck + testes por PR (`.github/workflows/ci.yml`)
- [x] Documentar como rodar E2E em CI (`docs/TESTING.md`)

---

## Fase 5 – Super Admin

**Status:** ✅ Concluída (2026-03-16)

Objetivo: criar área de Super Admin com visão consolidada da plataforma.

- [x] Definir role `super_admin` no banco (`admin_members.role` com valor `super_admin`)
- [x] Criar rota protegida `/admin/super` e hook `useRequireSuperAdmin`
- [x] Dashboard de saúde: resumo Commerce Health + webhooks com erro; link para `/admin/commerce-health`
- [x] Catálogo de endpoints/APIs (inventário visual: Stripe, Yampi, Appmax, Bling + Edge Functions)
- [ ] Área de Swagger/OpenAPI no admin (opcional, futura)
- [x] Menu lateral "Super Admin" apenas para `super_admin` e `owner`

---

## Fase 6 – Performance e UX

**Status:** ✅ Concluída (2026-03-16)

Objetivo: otimizar bundle, carregamento e experiência do usuário.

- [x] Análise de bundle com rollup-plugin-visualizer (`npm run build:analyze` → `dist/stats.html`)
- [x] Code splitting para páginas admin (lazy + manualChunks `admin` em `vite.config.ts`)
- [x] Lazy loading de imagens (`loading="lazy"` e `decoding="async"` em Cart, CheckoutStart, SearchPreview, VariantSelectorModal, BuyTogether, CartProductSuggestions)
- [x] Melhorar estados de loading/erro em fluxos críticos (PageFallback com role/aria-live/aria-busy e texto "Carregando..."; ErrorBoundary com role="alert" e aria-live="assertive")
- [x] Melhorias de acessibilidade (aria-labels no ProductCard favoritar/comprar, Header carrinho e remover item; role status/alert em fallbacks e erro)

---

## Fase 7 – Multi-tenant (longo prazo)

**Status:** ✅ Concluída (base pronta; múltiplos tenants operacionais na Fase 8)

Objetivo: preparar a plataforma para múltiplas lojas independentes.

- [x] Schema multi-tenant: tabela `tenants` + `tenant_id` nas tabelas de negócio
- [x] Políticas RLS por tenant (`user_tenants`, `get_current_tenant_id()`, `is_super_admin()`, políticas em 14 tabelas)
- [x] Tenant discovery (constante + hook `useTenant()`; domínio/path planejado para Fase 8)
- [x] Adaptar Edge Functions para `tenant_id` (uso explícito em checkout-router, stripe-webhook; ver `_shared/tenant.ts` e cliente com `tenantId`)
- [x] Adaptar frontend para identificar tenant ativo (`useTenant()`, `src/lib/tenant.ts`)
- [x] Migrar dados do modo single-tenant (backfill na migration schema)
- [ ] Testes de isolamento entre tenants (Fase 8)

Para o design detalhado, ver [`MULTITENANT_DESIGN.md`](MULTITENANT_DESIGN.md).

**Mudanças de banco (Fases 1–7):** Todas as alterações necessárias no banco até a Fase 7 estão nas migrations listadas em [`DATABASE_MIGRATIONS_FASES_1_A_7.md`](DATABASE_MIGRATIONS_FASES_1_A_7.md), com detalhes do que cada uma faz e como aplicar.

---

## Fase 8 – Isolamento e discovery multi-tenant

**Status:** ✅ Concluída (2026-03-17)

Objetivo: garantir isolamento por loja (RLS) e identificar o tenant em cada request (domínio ou path).

- [x] Políticas RLS por tenant *(já implementadas na Fase 7)*
- [x] Função `get_current_tenant_id()` e resolução por domínio/slug *(Fase 7 + discovery na Fase 8)*
- [x] Tenant discovery: resolução por domínio (`tenants.domain`) e por path (`/loja/:slug`) em `src/lib/tenant.ts` e `useTenant()`
- [x] Testes de isolamento: testes unitários em `src/test/tenant.test.ts` (resolução por contexto; RLS garante isolamento no banco)

---

## Billing dos lojistas (Prioridade 1 – SaaS)

**Status:** ✅ Concluída (2026-03-19)

Objetivo: cobrança de assinaturas dos tenants (lojistas) via Stripe Billing; modelo de planos e feature gates no frontend.

- [x] Migration `20260319100000_tenant_billing_schema.sql`: tabela `tenant_plans`, colunas de billing em `tenants`
- [x] Webhook `checkout-stripe-webhook`: handlers para `customer.subscription.created/updated/deleted`
- [x] Frontend: tipos em `src/types/billing.ts`, helpers em `src/lib/plans.ts`, hooks `useTenantPlan` e `usePlanGate`
- [x] Documentação: [`TENANT_BILLING_STRIPE.md`](TENANT_BILLING_STRIPE.md)
- [ ] Criar Stripe Customer + Subscription no onboarding (Edge Function ou Server Action)
- [ ] Página de planos e redirect para Stripe Checkout (Subscription) ou Customer Portal
