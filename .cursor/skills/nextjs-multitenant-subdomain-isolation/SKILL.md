---
name: nextjs-multitenant-subdomain-isolation
description: Implementa multi-tenant por subdomínio no Next.js (App Router) com middleware de rewrite, resolução de tenant por host, separação de contexto e guardrails anti-cross-tenant. Use quando o usuário mencionar multi-tenant, subdomínio, wildcard domain, middleware.ts, tenant routing, isolamento por tenant, Supabase multi-tenant ou acesso por loja/empresa.
---

# Next.js Multi-tenant por Subdomínio (Isolamento)

## Objetivo

Aplicar um padrão confiável de **multi-tenant por subdomínio** (ex: `tenant.seudominio.com`) no Next.js App Router, garantindo:

- **Roteamento por host** via `middleware.ts` (Edge) com `rewrite`
- **Resolução consistente do tenant** (server-first)
- **Isolamento de dados** (filtro por `tenant_id` + RLS quando houver Supabase)
- **Anti cross-tenant** (nada de confiar em `tenant_id` vindo do client)

Referências inspiradoras:
- `GGCodeLatam/next-multitenant-2024` (subdomínio + middleware + App Router)
- `phamvuhoang/nextjs-supabase-boilerplate` (modelagem e organização com Supabase)

## Quick Start (fluxo recomendado)

- **1) Definir o identificador do tenant**
  - Padrão: `subdomain` (string) como chave pública
  - Persistência: tabela `tenants` com `id (uuid)` e `subdomain (unique)`

- **2) Implementar roteamento por subdomínio**
  - `middleware.ts`: extrair host → subdomínio → `rewrite` para `/${subdomain}${pathname}`
  - `matcher`: excluir `_next`, `api`, assets e arquivos com extensão

- **3) Resolver tenant no server**
  - Em Server Components / Route Handlers: inferir tenant **a partir do host/path reescrito**
  - Normalizar uma função única: `resolveTenantFromRequest()`

- **4) Isolar acesso a dados**
  - Consultas sempre com `tenant_id = <tenant.id>` no server
  - Se Supabase: preferir **RLS** com `tenant_id` obrigatório e policies

## Checklist de Guardrails (não negociar)

- [ ] **Nunca** aceitar `tenant_id` vindo do client como fonte de verdade
- [ ] **Nunca** reutilizar cache/shared state sem chavear por `tenant` (ex: `fetch` cache, tags, `unstable_cache`)
- [ ] `middleware.ts` **não** consulta banco (Edge). Apenas faz roteamento/normalização
- [ ] Rotas internas (`/api`, server actions) devem **re-resolver** o tenant no server
- [ ] Em produção, usar **wildcard domain** e garantir que `Host` está preservado (Vercel/Proxy/CDN)

## Padrão de Diretórios (App Router)

Use um segmento dinâmico para render tenant:

```
app/
  [tenant]/
    layout.tsx
    page.tsx
  (public)/
    page.tsx
middleware.ts
```

Notas:
- Se preferir separar “site público” vs “tenant”, roteie o root sem subdomínio para `(public)`.
- Dentro de `app/[tenant]/...`, ainda assim trate `params.tenant` como **derivado do host** (via rewrite), não como input confiável do usuário.

## Middleware: regras mínimas

Siga este comportamento:

1. Obter `hostname` e extrair `subdomain`
2. Se `subdomain` for válido:
   - `rewrite` para `/${subdomain}${pathname}`
3. Caso contrário:
   - `next()`

Para exemplos completos, veja: [examples.md](examples.md).

## Resolução de Tenant (server-first)

Crie uma função única que:

- Deriva `tenantSlug` a partir do `host` (preferível) ou do path já reescrito (`/tenant/...`)
- Busca `tenant` (por slug) e retorna `{ tenant, tenantId }`
- Falha de forma previsível (404 / redirect / erro estruturado)

Detalhes e decisões comuns: [reference.md](reference.md).

## Integração com Supabase (quando aplicável)

- Isolamento “de verdade” = **RLS** no Postgres + `tenant_id` obrigatório em tabelas multi-tenant.
- No Next.js, prefira client SSR (`@supabase/ssr`) no server e políticas RLS por tenant.

Se você já tem uma skill específica de RLS/tenant_id, use esta skill principalmente para **subdomínio + middleware + resolução de contexto**.

## Anti-padrões comuns

- Usar `params.tenant`/`pathname` como “tenant confiável” sem validação
- Guardar `tenantId` em `localStorage` e usar como filtro principal
- Cache de dados compartilhado (ISR/revalidate) sem chavear por tenant
- “Bloquear” no client (router guard) e achar que isso é segurança

