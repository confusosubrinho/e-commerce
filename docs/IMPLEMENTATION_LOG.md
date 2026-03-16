# Log de Implementação

Registro detalhado de todas as mudanças realizadas no projeto.
Toda vez que uma alteração for feita, deve ser adicionada aqui com data, arquivos e descrição.

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
