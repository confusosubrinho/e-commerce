# Guia de Testes

Como rodar, escrever e organizar testes no projeto.

---

## Tipos de teste

| Tipo | Framework | Localização | Quando rodar |
|------|-----------|------------|-------------|
| Unitários | Vitest | `src/test/` | Em todo PR |
| Componentes | Vitest + Testing Library | `src/test/` | Em todo PR |
| E2E | Playwright | `e2e/` | Antes de deploy em produção |

---

## Comandos

```bash
# Rodar todos os testes unitários
npm run test

# Rodar testes em modo watch (desenvolvimento)
npm run test:watch

# Rodar testes E2E (Playwright)
npm run test:e2e

# Rodar E2E com interface gráfica
npm run test:e2e:ui

# Ver relatório do último run E2E
npm run test:e2e:report

# Rodar TUDO (lint + typecheck + unit + e2e)
npm run qa:ultimate

# Rodar apenas verificações de backend
npm run qa:backend
```

---

## Testes unitários (Vitest)

### Estrutura
```
src/
└── test/
    ├── webhook-security.test.ts      – segurança de webhooks
    ├── release-expired-reservations.test.ts – expiração de reservas
    ├── formatters.test.ts            – preço, data, status, provider
    ├── pricingEngine.test.ts         – PIX, parcelas, gateway
    ├── cartPricing.test.ts           – preço unitário/total, hasSaleDiscount
    ├── purchase-flow.test.tsx        – fluxo carrinho + CheckoutStart (HelmetProvider)
    └── (outros)
```

### Como escrever um teste unitário

```typescript
import { describe, it, expect } from 'vitest';
import { funcaoATestar } from '../lib/utils';

describe('funcaoATestar', () => {
  it('deve retornar X quando Y', () => {
    const resultado = funcaoATestar('input');
    expect(resultado).toBe('esperado');
  });

  it('deve lançar erro quando Z', () => {
    expect(() => funcaoATestar(null)).toThrow('mensagem esperada');
  });
});
```

### Áreas prioritárias para testes unitários
- Funções de formatação de preços e datas (`src/lib/formatters.ts`) ✅
- Motor de preços e parcelas (`src/lib/pricingEngine.ts`) ✅
- Preço de item no carrinho (`src/lib/cartPricing.ts`) ✅
- Regras de status de pedido (transições válidas/inválidas)
- Matching de SKUs Yampi ↔ produtos locais
- Validação de webhooks (segurança) ✅
- Lógica de cálculo de totais e frete

---

## Testes E2E (Playwright)

### Pré-requisitos
```bash
# Instalar browsers do Playwright
npx playwright install
```

### Estrutura
```
e2e/
├── specs/
│   ├── checkout-stripe-internal.spec.ts
│   ├── checkout-stripe-external.spec.ts
│   ├── checkout-yampi-external.spec.ts
│   ├── checkout-start-thin.spec.ts
│   ├── idempotency-double-click.spec.ts
│   └── refresh-resume.spec.ts
├── api/
│   └── reprocess-stripe-webhook.spec.ts
├── helpers/
│   ├── http.ts
│   └── settings.ts
├── global-setup.ts
└── admin-panel-full.spec.ts
```

### Cenários mínimos cobertos
- [ ] Checkout Stripe (transparente/interno)
- [ ] Checkout Stripe (externo/redirect)
- [ ] Checkout Yampi (externo)
- [ ] Idempotência (duplo clique não cria dois pedidos)
- [ ] Refresh e retomada de sessão de checkout
- [ ] Reprocessamento de webhook Stripe

### Configuração
Os testes E2E precisam de variáveis de ambiente. Copie `e2e/.env.example` (se existir) ou configure as variáveis necessárias.

- **Timeout global:** 60s por teste (`playwright.config.ts`), para reduzir falhas em fluxos com redirect/network.
- **Retries em CI:** 2; sem retry local.

---

## Cobertura mínima esperada

| Área | Cobertura mínima |
|------|-----------------|
| `src/lib/` (utilitários) | 80% |
| Lógica de checkout | 70% |
| Validação de webhooks | 100% |
| Componentes críticos (Checkout, ProductDetail) | 50% |

---

## CI/CD

### CI (todo PR)

O workflow `.github/workflows/ci.yml` roda em todo **push** e **pull request** para `main`:

- `npm run lint`
- `npm run typecheck`
- `npm run test` (testes unitários e de componente)

Nenhum segredo é necessário; o CI não acessa Supabase nem APIs externas.

### E2E em CI

Os testes E2E (Playwright) **não** rodam automaticamente em todo PR. O workflow `.github/workflows/e2e.yml` está configurado com **workflow_dispatch**: para rodar, vá em **Actions → E2E → Run workflow**.

**Requisitos para rodar E2E em CI:**

1. Configurar no repositório os **secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` (recomendado: projeto Supabase de staging).
2. Ao disparar o workflow, o job instala dependências, instala o browser Chromium do Playwright e executa `npm run test:e2e`.
3. Os **artifacts** (relatório HTML, traces e screenshots em falha) ficam disponíveis na run por 7 dias.

**Comando local equivalente:** `npm run test:e2e` (com `.env` ou `.env.local` apontando para o ambiente desejado).

---

## Debugging de testes

### Vitest
```bash
# Rodar um arquivo específico
npx vitest src/test/webhook-security.test.ts

# Modo verbose
npx vitest --reporter=verbose
```

### Playwright
```bash
# Rodar um spec específico
npx playwright test e2e/specs/checkout-stripe-internal.spec.ts

# Modo headed (ver o browser)
npx playwright test --headed

# Debug step-by-step
npx playwright test --debug
```
