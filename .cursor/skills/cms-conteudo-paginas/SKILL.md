---
name: cms-conteudo-paginas
description: Define padrões para CMS leve de conteúdo editável (páginas, blocos, mídia e SEO) em apps Next.js, com suporte a multi-tenant. Use quando o usuário mencionar CMS, conteúdo editável, páginas, landing pages, blocos, page builder, editor, SEO, slugs, preview, drafts, admin/backoffice, mídia/imagens, ou citar Payload CMS como referência.
---

# CMS / Conteúdo editável / Páginas (CMS leve)

## Objetivo

Modelar um CMS leve inspirado em como o **Payload** organiza **páginas + blocos + mídia + SEO + admin**, mas implementado sob medida (ex.: Lovable/Next) e pronto para **multi-tenant**.

## Princípios (obrigatórios)

- **Multi-tenant real**: toda entidade de CMS tem `tenant_id` e políticas/queries nunca podem vazar entre tenants.
- **Draft/publish explícito**: a UI pode editar “rascunho”, mas a renderização pública deve buscar **somente publicado** (ou por token/preview).
- **Blocos renderizáveis**: conteúdo é uma árvore de blocos com `type` + `props` (evitar acoplamento com componentes de UI específicos).
- **SEO como parte do modelo**: metadados e canônicos não são “depois”; fazem parte do schema.
- **Admin com estados completos**: `loading`, `error`, `empty`, `success` em listagens e editor.

## Modelo mínimo (o que precisa existir)

### 1) Páginas

- **Identidade**: `id`, `tenant_id`
- **Roteamento**: `slug` (ou `path`) + `locale` (opcional)
- **Estado**: `status` (`draft` | `published` | `archived`)
- **Conteúdo**: `blocks` (JSON) + campos “globais” opcionais (ex.: `title`)
- **SEO**: `seo_title`, `seo_description`, `og_image_id`, `canonical_url`, `noindex`
- **Publicação**: `published_at` + `updated_at`

Regra: `slug` deve ser **único por tenant** (e por `locale`, se tiver).

### 2) Blocos (page builder)

Padrão: cada bloco tem:

- `id` (uuid)
- `type` (string)
- `props` (objeto)

E opcionalmente:

- `children` (lista de blocos) quando fizer sentido
- `conditions` (ex.: visibilidade por feature flag)

### 3) Mídia (biblioteca)

- `id`, `tenant_id`
- `bucket`, `path`
- `mime_type`, `size`, `width`, `height`, `alt`
- `created_at`

Padrão de path recomendado: `tenantId/YYYY/MM/uuid.ext` (ou `tenantId/userId/uuid.ext`).

## Renderização no Next.js (padrão prático)

### Resolução de rota

- Rota do site resolve `tenant` (subdomínio/path) e então busca a página por `slug`.
- **Público**: buscar somente `status = published` e `published_at <= now`.
- **Preview**: permitir `draft` via token/permite (não via query param aberto).

### Registro de blocos

Use um “registry” canônico:

- `record<blockType, renderer>`
- renderer recebe `props` tipados + contexto (tenant, locale)
- fallback: bloco desconhecido → renderizar placeholder seguro (não quebrar página inteira)

### Caching / revalidação

- Ao publicar/atualizar página: revalidar por `slug` e por “tags” (ex.: `page:{tenant}:{slug}`).
- Evite `useEffect` para buscar conteúdo de página; prefira RSC/handlers.

## Admin (workflow mínimo)

- **Listagem de páginas**: busca, filtro por status, paginação.
- **Editor**: JSON de blocos (ou builder), validação, salvar draft.
- **Publicar**: ação explícita, atualiza `published_at`, muda status e dispara revalidação.
- **Preview**: link seguro para renderizar draft (token de curta duração).

## Anti-patterns (evitar)

- Guardar HTML pronto como fonte de verdade (perde composição/SEO/controle).
- Renderização pública aceitar `draft=true` sem autorização.
- `slug` global sem `tenant_id` (quebra isolamento).
- Bloco sem `type` (conteúdo vira “massa amorfa” difícil de migrar).

## Recursos

- Exemplos práticos (schemas, blocos, fluxos): [examples.md](examples.md)
- Checklist detalhado + referência Payload: [reference.md](reference.md)

