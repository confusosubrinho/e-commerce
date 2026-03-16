# Guia de Contribuição

Padrões e fluxo de trabalho para contribuir com este projeto.

---

## Pré-requisitos

- Node.js 20+
- npm 10+
- Conta Supabase com projeto de desenvolvimento configurado
- Variáveis de ambiente configuradas (veja `.env.example`)

---

## Branches

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Feature nova | `feat/descricao-curta` | `feat/super-admin-dashboard` |
| Correção de bug | `fix/descricao-do-bug` | `fix/yampi-import-sku` |
| Documentação | `docs/descricao` | `docs/multitenant-design` |
| Refatoração | `refactor/descricao` | `refactor/checkout-hooks` |
| Hotfix em produção | `hotfix/descricao` | `hotfix/stripe-webhook-error` |
| Release | `release/vX.Y.Z` | `release/v1.2.0` |

### Regras de branch
- **Nunca commitar diretamente em `main`** sem revisão.
- Branches criadas a partir de `main` (ou `develop` se existir).
- Nomes em minúsculas com hífens, sem espaços ou underscores.

---

## Commits (Conventional Commits)

Seguimos o padrão [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<escopo opcional>): <descrição curta em português>

[corpo opcional – mais detalhes]

[rodapé opcional – BREAKING CHANGE, fixes #123, etc.]
```

### Tipos de commit

| Tipo | Quando usar |
|------|------------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Apenas documentação |
| `refactor` | Refatoração sem mudar comportamento |
| `style` | Formatação, espaços, ponto-e-vírgula (sem mudança de lógica) |
| `test` | Adicionar ou corrigir testes |
| `chore` | Manutenção, atualização de dependências, configs |
| `perf` | Melhoria de performance |
| `ci` | Mudanças em CI/CD |
| `build` | Sistema de build, dependências externas |
| `revert` | Reverter um commit anterior |

### Exemplos de commits corretos

```
feat(checkout): adicionar suporte a checkout Appmax transparente
fix(yampi): corrigir extração de SKU em pedidos importados
docs: criar documentação de arquitetura e checkout
refactor(orders): extrair helper formatOrderStatus para src/lib
test(webhook): adicionar testes de segurança para webhook Stripe
chore: atualizar dependências de segurança
```

### Escopos comuns

`checkout`, `orders`, `products`, `admin`, `yampi`, `stripe`, `appmax`, `bling`, `auth`, `ui`, `db`

---

## Checklist de Pull Request

Antes de abrir ou pedir review em um PR:

### Código
- [ ] Lint passa: `npm run lint`
- [ ] Tipos corretos: `npm run typecheck`
- [ ] Testes passam: `npm run test`
- [ ] Nenhum `console.log` de debug deixado no código
- [ ] Nenhum `any` desnecessário adicionado

### Segurança
- [ ] Nenhum segredo/credencial commitado
- [ ] Novas Edge Functions validam autenticação
- [ ] Dados pessoais não são logados

### Checkout e pagamentos
- [ ] Mudanças no fluxo de checkout foram testadas localmente?
- [ ] Idempotência mantida (pagamentos, webhooks)?
- [ ] Status de pedidos não regride?

### Banco de dados
- [ ] Mudanças de schema têm migration em `supabase/migrations/`?
- [ ] `docs/SUPABASE_CHANGELOG.md` atualizado se migration foi aplicada?
- [ ] Seguiu as regras de `docs/SUPABASE_CHANGES_PLAN.md`?

### Documentação
- [ ] `docs/IMPLEMENTATION_LOG.md` atualizado com as mudanças?
- [ ] Documentação relevante atualizada?

---

## Fluxo de desenvolvimento

```
1. Criar branch a partir de main
   git checkout main && git pull
   git checkout -b feat/minha-feature

2. Desenvolver com commits frequentes e descritivos
   git add .
   git commit -m "feat(area): o que foi feito"

3. Rodar verificações locais
   npm run qa:backend  # typecheck + testes

4. Push e abrir PR
   git push -u origin feat/minha-feature
   # Abrir PR no GitHub/Lovable

5. Aguardar review e CI passar

6. Merge após aprovação
```

---

## Padrões de código

### TypeScript
- Sempre tipar retornos de funções quando não óbvio.
- Evitar `any` – usar `unknown` e fazer type guard quando necessário.
- Usar tipos de domínio de `src/types/` em vez de tipos inline repetidos.

### React
- Componentes de UI em `src/components/` sem lógica de negócio.
- Lógica e fetch de dados em hooks (`src/hooks/`).
- Handlers de eventos claramente nomeados (`handle...` ou `on...`).

### Edge Functions (Deno)
- Seguir o padrão descrito em [`docs/EDGE_FUNCTIONS_GUIDE.md`](docs/EDGE_FUNCTIONS_GUIDE.md).
- Usar `import/export` ESM, nunca `require()`.
- Variáveis de ambiente via `Deno.env.get()`.

---

## Dúvidas?

Consulte a documentação em `docs/` ou abra uma issue no repositório.
