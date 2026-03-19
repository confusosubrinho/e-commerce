# Referência: Multi-tenant por subdomínio no Next.js

## 1) Terminologia (consistente)

- **tenant**: organização/loja/empresa (entidade isolada)
- **tenantSlug/subdomain**: identificador público do tenant (string)
- **tenantId**: UUID interno (chave primária)
- **host**: `tenant.seudominio.com` (fonte primária no request)
- **rewrite**: `/${tenantSlug}${pathname}` (forma de transportar o contexto para o App Router)

## 2) Matcher recomendado (evitar interceptar assets)

Objetivo: não rodar middleware em rotas internas e arquivos estáticos.

Padrão comum:

- Excluir:
  - `/api/*`
  - `/_next/*`
  - `/_static/*` (se existir)
  - `/_vercel/*` (se existir)
  - Qualquer path que pareça arquivo: `[\w-]+\.\w+`

## 3) Regras para extrair o subdomínio

1. Pegue `hostname` do `req.nextUrl` (ou `req.headers.get('host')` quando necessário).
2. Normalize:
   - Remova porta (`:3000`)
   - Se estiver em dev, considere `tenant.localhost` (subdomain = `tenant`)
3. Obtenha o primeiro label:
   - `sub = hostname.split('.')[0]`
4. Liste de “subdomínios reservados”:
   - `www`, `app`, `admin`, `api`, `static`, etc.

**Importante**: a validação “tenant existe?” não precisa ocorrer no Edge; pode ocorrer no server após o rewrite.
Se você mantiver uma lista local (ex: `subdomains.json`) para roteamento, trate como “allow-list” de dev/preview.

## 4) Resolver tenant no server (o ponto de segurança)

Requisitos:

- Derivar `tenantSlug` do request (host ou do path reescrito)
- Mapear para um tenant real (`tenants.subdomain = tenantSlug`)
- Retornar um objeto “contexto de tenant” que vai para repositórios/queries

Fonte do tenantSlug:

- **Preferível**: `Host` (mais resistente a manipulação de URL)
- **Alternativa**: `params.tenant` em `app/[tenant]/...` (desde que seja consequência do rewrite e validado)

## 5) Cache / revalidate / tags (onde geralmente vaza tenant)

Principais riscos:

- `fetch()` cacheado sem chavear por tenant (mesma URL para todos)
- `unstable_cache()` com key parcial
- `revalidateTag('products')` sem prefixo do tenant

Regras:

- Inclua `tenantId` (ou `tenantSlug`) em:
  - cache key
  - tags
  - paths revalidados

## 6) Supabase / RLS (alto nível)

Se usar Supabase:

- Todas as tabelas multi-tenant têm `tenant_id not null`
- Políticas RLS filtram por tenant + usuário
- O server decide o tenant (do host) e nunca confia em `tenant_id` do client

## 7) Deploy: wildcard domain

Checklist:

- DNS: `*.seudominio.com` apontando para o app
- Plataforma (ex: Vercel): habilitar wildcard domain
- Proxy/CDN: garantir que o header `Host` chega íntegro

## 8) Dev local com subdomínios

Opções:

- Usar `tenant.localhost:3000` (muitos browsers aceitam)
- Editar `hosts` para mapear `tenant.local` → `127.0.0.1`
- Usar um proxy local que injeta host (menos recomendado)

## 9) Onde colocar validações de tenant

- **middleware**: apenas roteamento e normalização; sem chamadas de rede/banco
- **server (route handlers / server actions / RSC)**:
  - validar tenant
  - verificar associação usuário↔tenant (quando necessário)
  - aplicar filtros/authorização

