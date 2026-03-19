# Referência — Isolamento multi-tenant “de verdade”

## 1) Onde normalmente quebra (armadilhas)

- **`tenant_id` opcional**: se qualquer tabela crítica não tiver `tenant_id not null`, você abriu uma porta.
- **Policies incompletas**: ter SELECT sem INSERT/UPDATE/DELETE costuma vazar via mutações indiretas.
- **Service Role em rota pública**: `SUPABASE_SERVICE_ROLE_KEY` bypassa RLS. Se cair num endpoint acessível pelo usuário, acabou o isolamento.
- **Cross-tenant por relacionamento**: `order_items -> products` (ou `orders -> customers`) precisa validar consistência de tenant.
- **Tenant vindo do body/header sem verificação**: usuário troca `tenantId` e acessa outra loja.
- **Admin “global” sem trilha**: se existe superadmin, você precisa de regras explícitas e auditáveis.

## 2) Padrões de modelagem recomendados

### Tenant + Membership (padrão default)

- `tenants`
- `tenant_members(tenant_id, user_id, role)`
- tabelas tenant-scoped com `tenant_id`
- policies usando `exists(...)` ou `is_tenant_member(tenant_id)`

Vantagens:
- simples de raciocinar
- funciona bem com Supabase Auth (`auth.uid()`)
- reduz “ifs” no app

### Tenant no JWT (avançado; use com cuidado)

Você pode colocar `tenant_id`/`active_tenant_id` em claims.
Isso é útil quando:
- o usuário alterna “loja ativa” com frequência
- o backend precisa de tenant ativo sem roundtrip de DB

Riscos:
- manter claim atualizado é responsabilidade do seu backend (e pode ficar inconsistente)
- se você permitir “active_tenant_id” sem checar membership, você cria bypass

Regra: mesmo com claim, mantenha uma validação por membership em algum ponto crítico
(RLS ou backend).

## 3) Backend: filtros automáticos por tenant (como pensar)

Defina um ponto único que resolve o tenant efetivo:

- **entrada**: sessão do usuário (token/cookie) + contexto de UI (ex.: loja selecionada)
- **saída**: `tenantId` confiável (validado por membership)

Então aplique esse tenant automaticamente:

- queries: sempre `... where tenant_id = tenantId`
- writes: sempre setar `tenant_id = tenantId`
- reads por `id`: buscar por `(id, tenant_id)`; se não achar, 404

Se o projeto usa “repositories/services”, o filtro por tenant deve morar no **repositório**,
não no controller/route, para evitar esquecimento.

## 4) DB: constraints e índices mínimos

Para cada tabela tenant-scoped:

- `tenant_id uuid not null`
- index em `(tenant_id)`
- se houver “slug”/“codigo” único dentro do tenant: unique em `(tenant_id, slug)`

Exemplo:

```sql
create unique index if not exists products_tenant_slug_uniq
  on public.products(tenant_id, name);
```

## 5) Cross-tenant em relações: 3 estratégias

- **Validação no backend** (mais comum): ao criar `order_item`, carregue `product.tenant_id` e compare
- **Trigger no banco**: enforce forte, centralizado, independente de app
- **Chave composta (tenant_id, id)**: mais “pesado”, mas evita classes de bugs (exige modelagem intencional)

Regra prática:
- Se o custo do bug é alto (financeiro/privacidade), prefira trigger ou chave composta.

## 6) Papéis de painel (admin / staff / member)

Evite “admin global” por padrão. Prefira:

- `role` na `tenant_members`
- policies condicionais por role (se necessário)

Exemplo (apenas admin pode deletar):

```sql
create or replace function public.is_tenant_admin(p_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner', 'admin')
  );
$$;
```

## 7) Regra de ouro (para auditoria)

Se você pegar qualquer `id` de entidade tenant-scoped no backend, a pergunta obrigatória é:

> “Eu consigo provar que esse `id` pertence ao `tenantId` efetivo do usuário?”

Se a resposta não for “sim, por RLS/constraint + filtro”, o sistema está vulnerável a cross-tenant.

