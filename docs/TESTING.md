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
    ├── webhook-security.test.ts   – segurança de webhooks
    ├── release-expired-reservations.test.ts – expiração de reservas
    └── (novos testes aqui)
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
- Funções de formatação de preços e datas (`src/lib/`)
- Regras de status de pedido (transições válidas/inválidas)
- Matching de SKUs Yampi ↔ produtos locais
- Validação de webhooks (segurança)
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

O pipeline de CI (GitHub Actions ou similar) deve rodar em todo PR:

```yaml
# .github/workflows/ci.yml (exemplo)
- npm run lint
- npm run typecheck
- npm run test
```

E2E roda antes de deploy em produção (não em todo PR, para evitar lentidão).

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
