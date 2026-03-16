# Estratégia de Ambientes

## Ambientes existentes

| Ambiente | URL frontend | Projeto Supabase | Uso |
|----------|-------------|-----------------|-----|
| **Desenvolvimento local** | `http://localhost:8080` | Projeto de dev (ou local via CLI) | Desenvolvimento e testes |
| **Staging** | Preview branch (Lovable/Vercel) | Projeto Supabase separado | Validação antes de produção |
| **Produção** | `https://vanessalimashoes.com.br` | Projeto Supabase de produção | Site real dos clientes |

---

## Regras de uso por ambiente

### Desenvolvimento local
- Use um projeto Supabase separado ou o Supabase CLI local (`supabase start`).
- Nunca aponte `.env` local para o projeto de produção.
- Gateways de pagamento em modo **sandbox/test** (Stripe test keys, Yampi sandbox, etc.).

### Staging
- Espelho do ambiente de produção com dados de teste.
- Toda migration de maior risco deve ser aplicada e validada aqui **antes da produção**.
- Checklist de validação em staging (ver abaixo).

### Produção
- Nunca aplicar migrations sem testar em staging primeiro (para mudanças de risco).
- Nunca rodar scripts de seed ou teste em produção.
- Backup antes de qualquer migration destrutiva.

---

## Checklist de validação em staging

Após aplicar uma migration ou mudança significativa em staging, verificar:

- [ ] Home da loja carrega corretamente
- [ ] Listagem de produtos funciona
- [ ] Detalhe de produto exibe variações e imagens
- [ ] Carrinho adiciona e remove produtos
- [ ] Checkout inicia e chega até a tela de pagamento
- [ ] Admin login funciona
- [ ] Admin lista pedidos e produtos
- [ ] Integrações principais respondem (testar conexão no admin)

---

## Configuração de variáveis de ambiente por ambiente

Cada ambiente tem seu próprio `.env` (local) ou configuração de variáveis na plataforma (staging/produção).

Ver `.env.example` para a lista completa de variáveis necessárias.

**Regra:** variáveis com `VITE_` prefix são expostas ao browser. Nunca colocar segredos sensíveis (chaves secretas de API, webhook secrets) em variáveis `VITE_`.

Segredos de Edge Functions são configurados nas **Supabase Secrets** (não no `.env` do projeto):

```bash
# Configurar via CLI:
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set YAMPI_TOKEN=...
# etc.
```

---

## Estratégia de branches (Git + ambientes)

| Branch Git | Ambiente | Deploy automático |
|-----------|----------|-----------------|
| `main` | Produção | Sim (via Lovable) |
| `develop` | Staging | Recomendado configurar |
| `feat/*`, `fix/*` | Preview | Por PR (Lovable/Vercel) |

Ver [`CONTRIBUTING.md`](../CONTRIBUTING.md) para detalhes sobre branches e commits.
