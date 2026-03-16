# Segurança, Backup e Privacidade

Visão geral das práticas de segurança, gestão de segredos, backup e privacidade do projeto.

---

## Gestão de segredos

### Regras obrigatórias
- **Nunca commitar `.env`** com valores reais. O arquivo `.env` está no `.gitignore`.
- **Variáveis `VITE_` são públicas** – visíveis no bundle do browser. Nunca colocar chaves secretas em variáveis `VITE_`.
- **Segredos das Edge Functions** são configurados via Supabase Secrets (não no `.env`):
  ```bash
  supabase secrets set STRIPE_SECRET_KEY=sk_live_...
  supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
  supabase secrets set YAMPI_TOKEN=...
  ```

### Variáveis seguras (browser)
- `VITE_SUPABASE_URL` – URL pública do projeto Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` – Anon key pública do Supabase

### Segredos (somente backend/Edge Functions)
- `STRIPE_SECRET_KEY` – Chave secreta Stripe
- `STRIPE_WEBHOOK_SECRET` – Secret de validação de webhook Stripe
- `YAMPI_TOKEN` – Token de autenticação Yampi
- `YAMPI_ALIAS` – Alias da loja Yampi
- `APPMAX_API_KEY` – Chave da API Appmax
- `BLING_CLIENT_ID` / `BLING_CLIENT_SECRET` – OAuth Bling
- Outros conforme novas integrações forem adicionadas

---

## Segurança nas Edge Functions

### Autenticação e autorização
- Toda Edge Function que acessa dados sensíveis ou executa ações de admin valida:
  1. Presença do header `Authorization: Bearer <token>`
  2. Validade do JWT via `supabase.auth.getUser(token)`
  3. Role do usuário (admin vs. super_admin)
- Funções públicas (ex.: checkout, webhooks de gateway) têm validação própria:
  - Checkout: validação de CORS por origem
  - Stripe webhook: verificação de assinatura com `stripe.webhooks.constructEventAsync`
  - Yampi webhook: token de segurança na query string
  - Appmax webhook: validação de hash/event

### Idempotência
- Todos os webhooks de pagamento são idempotentes (ver [`CHECKOUT_FLOW.md`](CHECKOUT_FLOW.md)).

### CORS
- Origens permitidas configuradas em `supabase/functions/_shared/cors.ts`.
- Em produção, apenas origens autorizadas recebem resposta (não `*` wildcard).

---

## Privacidade e dados sensíveis (LGPD)

### Dados pessoais no banco
Colunas que contêm dados pessoais e devem ser tratadas com cuidado:

| Tabela | Colunas sensíveis |
|--------|------------------|
| `orders` | `customer_name`, `customer_email`, `customer_phone`, `shipping_address` |
| Supabase Auth | `email`, `phone`, metadados de usuário |

### Regras de tratamento
- **Não logar** dados pessoais em logs de erro ou debug.
- **Não exibir** dados pessoais desnecessariamente em telas de Super Admin.
- **Não compartilhar** em respostas de APIs que não precisam desses dados.
- Em futuras implementações, considerar mascaramento parcial (ex.: `jo***@gmail.com`).

---

## Backup e recuperação

### Backup do banco (Supabase)
- O Supabase Pro/Team faz backups automáticos diários com retenção de 7 dias (plano gratuito) ou mais (planos pagos).
- Para dados críticos, exportar backup manual regularmente:
  ```bash
  supabase db dump -f backup_YYYY-MM-DD.sql --linked
  ```

### Antes de qualquer migration de risco
1. Exportar backup manual do banco.
2. Testar a migration em staging.
3. Ter o script de rollback documentado.
4. Aplicar em produção em horário de baixo tráfego.

### Como reverter uma migration
1. Criar nova migration com as operações inversas (ex.: `DROP COLUMN` se a anterior fez `ADD COLUMN`).
2. Se dados foram modificados: usar o backup para restaurar.
3. Nunca restaurar backup diretamente em produção sem verificar integridade.

---

## Checklist de segurança para novas features

Antes de implementar qualquer nova funcionalidade que envolva:

- [ ] **Novo endpoint (Edge Function):** validação de auth/roles implementada?
- [ ] **Novo webhook externo:** validação de assinatura/token implementada?
- [ ] **Nova integração:** credenciais via Supabase Secrets (nunca hard-coded)?
- [ ] **Acesso a dados sensíveis:** RLS configurado? Dados pessoais mascarados nos logs?
- [ ] **Novo campo de banco:** tipo correto? `NOT NULL` ou `DEFAULT` definido?
- [ ] **Nova rota admin:** verificação de role admin/super_admin?
