## Checklist (CMS leve multi-tenant)

### Dados / banco

- **Tenant obrigatório**: `tenant_id NOT NULL` em `pages`, `media`, `page_versions` (se existir).
- **Unicidade**:
  - `unique (tenant_id, slug)` (e `locale`, se usar).
- **Status**:
  - `draft` / `published` / `archived` (evite booleanos ambíguos).
- **Publicação**:
  - Campo `published_at` para permitir “agendar” (futuro) e garantir consistência.

### Segurança (essencial)

- **RLS/ACL**:
  - Select público: só `published` e somente do `tenant_id` resolvido.
  - Admin/editor: só usuários com permissão no `tenant_id`.
- **Preview**:
  - Não aceitar “draft” via parâmetro aberto.
  - Token com expiração + escopo (tenant + page).
- **Mídia**:
  - Se bucket privado: usar signed URL ou proxy no servidor.

### Blocos (page builder)

- **Versionamento de blocos**:
  - Evite mudar significado de `props` sem uma estratégia de migração.
  - Prefira `props` com defaults robustos e “feature flags” por versão de bloco.
- **Migração**:
  - Quando renomear bloco/campo: mantenha compatibilidade por pelo menos 1 release (adapter).

### SEO (mínimo viável)

- `seo_title`, `seo_description`
- `canonical_url`
- `noindex` (e opcional: `nofollow`)
- `og_image_id` (ou `og_image_url` resolvida a partir de `media`)
- Regras:
  - `title` e `description` devem ter fallback sensato (ex.: `page.title`).
  - `canonical` deve ser estável por página publicada.

### Admin UX

- **Listagem**: busca por texto, filtro status, paginação.
- **Editor**: salvar draft frequente (com debounce), mas publicar só por ação explícita.
- **Validação**: erros devem apontar o bloco/field com problema.
- **Preview**: CTA claro e separado do botão publicar.

## O que “estudar” no Payload (sem adotar agora)

O Payload é uma referência madura de CMS nativo para Next.js. Use como “inspiração de modelagem” e decisões de produto/arquitetura, não como dependência imediata.

- **Coleções e schemas**: como modelam `pages`, `media`, `products` e relações.
- **Blocos**: como descrevem blocos reutilizáveis e composição de layout.
- **SEO**: como estruturam metas, previews e campos de social.
- **Admin**: padrões de listagem, edição, drafts e preview.

Referência principal:
- [payloadcms/payload](https://github.com/payloadcms/payload?utm_source=chatgpt.com)

## Sugestão de escopo para “CMS leve”

Comece com:

- `pages` (slug + blocks + seo + status)
- `media` (library + upload)
- “block registry” no frontend
- admin básico (listar/editar/publicar)

Deixe para depois (quando necessário):

- `page_versions`/revisions
- agendamento avançado
- localization completa
- editor rich text avançado com embeds/links internos

