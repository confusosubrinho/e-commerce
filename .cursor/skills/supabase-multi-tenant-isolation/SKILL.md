---
name: supabase-multi-tenant-isolation
description: Garante isolamento multi-tenant real com Supabase/Postgres usando tenant_id obrigatório, Row Level Security (RLS) por tenant, validações anti-cross-tenant e padrões de backend com filtros automáticos. Use quando o usuário mencionar multi-tenant, tenant_id, isolamento entre lojas, RLS, policies, Supabase, SaaS B2B, painel admin, acesso cruzado ou segregação de dados.
---

# Isolamento multi-tenant de verdade (Supabase + RLS + Backend)

## Objetivo

Projetos multi-tenant precisam nascer com **isolamento por `tenant_id`** como regra do sistema:

- `tenant_id` em todas as entidades críticas
- **RLS no Supabase** como barreira principal
- **filtros automáticos por tenant no backend**
- validação para impedir **acesso cruzado** entre lojas

Entidades que quase sempre são “tenant-scoped”:
`produtos`, `categorias`, `pedidos`, `clientes`, `cupons`, `banners`, `páginas`, `configurações`, `integrações`, `usuários do painel`.

## Princípios obrigatórios (curto)

- **RLS é a autorização**: backend e frontend não substituem policies.
- **Tenant nunca vem do client**: `tenant_id` efetivo deve vir da sessão/autorização server-side.
- **Negar por padrão**: enable RLS e só liberar via policies explícitas.
- **Defesa em profundidade**: RLS + filtros server + validação de ownership + constraints.
- **Service Role bypassa RLS**: use apenas em rotas/admin controladas e com autorização explícita.

## Checklist de implementação (faça nessa ordem)

- [ ] Definir modelo: **tenant + membership** (padrão recomendado)
- [ ] Criar tabelas: `tenants`, `tenant_members`, (opcional) `tenant_roles`
- [ ] Em toda tabela tenant-scoped: adicionar `tenant_id uuid not null`
- [ ] Adicionar constraints + índices por `tenant_id`
- [ ] Habilitar RLS em todas as tabelas tenant-scoped
- [ ] Criar policies (SELECT/INSERT/UPDATE/DELETE) baseadas em membership
- [ ] No backend: resolver `tenantId` a partir do usuário/sessão e aplicar filtro automático
- [ ] Validar “cross-tenant” em fluxos compostos (ex.: pedido -> itens -> produto)

## Padrão recomendado de dados (tenant + membership)

Use:

- `public.tenants(id, ...)`
- `public.tenant_members(tenant_id, user_id, role, ...)`
- tabelas tenant-scoped com `tenant_id`

As policies checam:
“usuário autenticado é membro do tenant do registro?”

## Regras de backend (obrigatórias)

Quando o backend receber um identificador de recurso (ex.: `orderId`), ele deve:

- **sempre** buscar o recurso **já filtrado por `tenantId` efetivo**
- se não existir: retornar **404** (não 403) para evitar enumeração
- em criação/atualização: **forçar** `tenant_id = tenantId` (não aceitar do body)

Se houver chamadas diretas do frontend ao Supabase:

- continue aplicando o filtro no código (boa prática de intenção),
  mas confie na RLS como “último gate”.

## Recursos

- Para SQL completo de schema + policies: veja [examples.md](examples.md)
- Para variações, decisões e armadilhas: veja [reference.md](reference.md)

