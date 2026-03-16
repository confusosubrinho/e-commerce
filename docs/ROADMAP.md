# Roadmap de Melhorias Enterprise

Fases de implementação do plano de melhoria da plataforma.

> Para o plano completo e detalhado, ver [`../c:\Users\William\.cursor\plans\melhorias-enterprise-ecommerce_dd1f7809.plan.md`](https://github.com).
> Para o log de mudanças já realizadas, ver [`IMPLEMENTATION_LOG.md`](IMPLEMENTATION_LOG.md).

---

## Fase 1 – Documentação e fundação (atual)

**Status:** ✅ Em andamento

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

**Status:** 🔜 Próxima

Objetivo: varredura de código morto/duplicado, centralização de helpers e tipos.

- [ ] Varredura de arquivos não utilizados e código morto
- [ ] Centralizar tipos de domínio em `src/types/domain.ts`
- [ ] Centralizar helpers de formatação em `src/lib/formatters.ts`
- [ ] Centralizar helpers de status de pedido em `src/lib/orderUtils.ts`
- [ ] Extrair helpers compartilhados de Edge Functions para `_shared/`
- [ ] Verificar consistência de runtimes (sem uso inesperado de Bun/CJS)
- [ ] Eliminar `any` desnecessários no TypeScript

---

## Fase 3 – Padrão de Edge Functions

**Status:** 🔜 Futura

Objetivo: padronizar todas as Edge Functions seguindo `EDGE_FUNCTIONS_GUIDE.md`.

- [ ] Auditar todas as 37 Edge Functions existentes
- [ ] Padronizar estrutura (handler pequeno + helpers)
- [ ] Extrair lógica repetida para `_shared/`
- [ ] Adicionar `correlationId` em todos os logs de erro
- [ ] Padronizar formato de resposta `{ ok, data, error, hint }`

---

## Fase 4 – Testes e CI

**Status:** 🔜 Futura

Objetivo: fortalecer cobertura de testes e automatizar qualidade no pipeline.

- [ ] Testes unitários para funções críticas de negócio
- [ ] Testes de componentes React (checkout, carrinho, ProductDetail)
- [ ] Revisar e estabilizar testes E2E existentes
- [ ] Configurar GitHub Actions com lint + typecheck + testes por PR
- [ ] Documentar como rodar E2E em CI

---

## Fase 5 – Super Admin

**Status:** 🔜 Futura

Objetivo: criar área de Super Admin com visão consolidada da plataforma.

- [ ] Definir role `super_admin` no banco
- [ ] Criar rota protegida `/admin/super`
- [ ] Dashboard de saúde: webhooks com erro, integrações
- [ ] Catálogo de endpoints/APIs (inventário visual)
- [ ] Área de Swagger/OpenAPI no admin
- [ ] Hook `useRequireSuperAdmin` no frontend

---

## Fase 6 – Performance e UX

**Status:** 🔜 Futura

Objetivo: otimizar bundle, carregamento e experiência do usuário.

- [ ] Análise de bundle com vite-bundle-visualizer
- [ ] Code splitting para páginas admin
- [ ] Lazy loading de imagens
- [ ] Melhorar estados de loading/erro em fluxos críticos
- [ ] Melhorias de acessibilidade (aria-labels, foco, contraste)

---

## Fase 7 – Multi-tenant (longo prazo)

**Status:** 🔜 Futura (planejamento em andamento)

Objetivo: preparar a plataforma para múltiplas lojas independentes.

- [ ] Schema multi-tenant: tabela `tenants` + `tenant_id` nas tabelas de negócio
- [ ] Políticas RLS por tenant
- [ ] Tenant discovery via domínio/path
- [ ] Adaptar Edge Functions para `tenant_id`
- [ ] Adaptar frontend para identificar tenant ativo
- [ ] Migrar dados do modo single-tenant
- [ ] Testes de isolamento entre tenants

Para o design detalhado, ver [`MULTITENANT_DESIGN.md`](MULTITENANT_DESIGN.md).
