# Design Multi-tenant

Documento de design de alto nível para a evolução da plataforma para o modelo multi-tenant (múltiplas lojas independentes na mesma infraestrutura).

> **Status:** Planejamento – ainda não implementado.
> Esta é a visão arquitetural. A implementação começa na Fase 7 do [`ROADMAP.md`](ROADMAP.md).

---

## Motivação

Permitir que múltiplas lojas independentes usem a mesma plataforma técnica, com:
- Dados completamente isolados entre tenants.
- Administração centralizada via Super Admin.
- Possibilidade de branding/domínio customizados por loja.

---

## Modelo de dados

### Tabela `tenants`

```sql
CREATE TABLE tenants (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,            -- nome da loja (ex.: "Vanessa Lima Shoes")
  slug      TEXT NOT NULL UNIQUE,     -- identificador (ex.: "vanessa-lima")
  domain    TEXT UNIQUE,              -- domínio customizado (ex.: "vanessalimashoes.com.br")
  active    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### tenant_id em todas as tabelas de negócio

Todas as tabelas de negócio recebem `tenant_id UUID REFERENCES tenants(id)`:
- `products`
- `product_variants`
- `orders`
- `order_items`
- `payments`
- `inventory_movements`
- `integrations_checkout`
- `integrations_checkout_providers`
- Outras tabelas de configuração por loja

**Estratégia de migração:**
1. Criar tabela `tenants` com um tenant padrão (a loja atual).
2. Adicionar coluna `tenant_id` com `DEFAULT <id do tenant padrão>`.
3. Atualizar todos os registros existentes com o `tenant_id` padrão.
4. Adicionar constraint `NOT NULL` após o backfill.

---

## Row Level Security (RLS)

### Política para admins de loja

```sql
-- Admin só acessa dados do seu tenant
CREATE POLICY "admin_tenant_isolation" ON orders
  USING (tenant_id = get_current_tenant_id());
```

### Função `get_current_tenant_id()`

Resolve o tenant a partir do JWT do usuário logado:

```sql
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id
  FROM user_tenants
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE;
```

### Super Admin

O `super_admin` bypassa as políticas RLS para acessar dados de qualquer tenant:

```sql
-- Super admin acessa tudo
CREATE POLICY "super_admin_bypass" ON orders
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );
```

---

## Descoberta de tenant (Tenant Resolution)

### Opção 1: Por subdomínio
```
loja1.plataforma.com  → tenant "loja1"
loja2.plataforma.com  → tenant "loja2"
```

### Opção 2: Por domínio customizado
```
vanessalimashoes.com.br → tenant por lookup em tenants.domain
outrashoes.com.br       → outro tenant
```

### Opção 3: Por path
```
plataforma.com/loja1  → tenant "loja1"
plataforma.com/loja2  → tenant "loja2"
```

**Recomendação:** Opção 2 (domínio customizado por tenant) para experiência mais profissional.

**Implementação no frontend:**
```typescript
// src/hooks/useTenant.ts
export function useTenant() {
  const hostname = window.location.hostname;
  // lookup em tenants via hostname
}
```

**Implementação nas Edge Functions:**
```typescript
// Resolver tenant a partir do header Origin ou parâmetro
const tenantId = await resolveTenantId(req.headers.get('origin'));
```

---

## Adaptações necessárias

### Frontend
- Hook `useTenant()` que resolve o tenant atual.
- Todos os hooks de dados passam `tenant_id` nas queries Supabase.
- Rota `/admin` filtra dados por `tenant_id` do admin logado.

### Edge Functions
- Todas as funções de checkout recebem/resolvem `tenant_id`.
- Pedidos são criados com `tenant_id` correto.
- Webhooks identificam o tenant pelo `external_reference` ou domínio.

### Integrações (Stripe, Yampi, Appmax, Bling)
- Cada tenant tem suas próprias credenciais de integração.
- `integrations_checkout_providers` já tem `tenant_id`.
- Webhooks dos gateways chegam para um endpoint compartilhado e são roteados pelo tenant.

---

## Super Admin Multi-tenant

A área `/admin/super` passa a gerenciar:
- Lista de todos os tenants com status, pedidos, receita.
- Configurações globais da plataforma.
- Integrações de cada tenant.
- Saúde por tenant (erros de webhook, etc.).

---

## Fases de implementação

**Fase 7a – Schema**
1. Criar tabela `tenants`
2. Criar tabela `user_tenants` e `user_roles`
3. Adicionar `tenant_id` nas tabelas de negócio (com valor padrão)
4. Migrar dados existentes

**Fase 7b – RLS**
1. Criar função `get_current_tenant_id()`
2. Adicionar políticas RLS em todas as tabelas com `tenant_id`
3. Testar acesso com usuários de tenants diferentes

**Fase 7c – Backend**
1. Adaptar Edge Functions de checkout para usar `tenant_id`
2. Adaptar webhooks para resolver `tenant_id` pelo domínio

**Fase 7d – Frontend**
1. Implementar `useTenant()`
2. Atualizar queries Supabase com filtro por `tenant_id`

**Fase 7e – Testes**
1. Testes E2E com dois tenants distintos
2. Verificar isolamento completo de dados
