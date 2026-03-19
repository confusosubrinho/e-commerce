# Referência — Supabase Storage (público vs privado) + políticas + serving

## Modelo mental (curto)

- **Storage é controlado por policies** em `storage.objects` (Postgres/RLS).
- **Bucket público**: facilita exibição (URL pública), mas não é para conteúdo sensível.
- **Bucket privado**: a exibição precisa de **signed URL** (temporária) ou **proxy no servidor**.

## Estrutura recomendada de dados

Evite depender só de “URL final”. Armazene no banco:

- `bucket`
- `path`
- `owner_user_id` (ou `tenant_id`)
- metadata (mime, size, etc.)

Isso te permite:

- rotacionar estratégias de serving (signed URL → proxy) sem migration de dados
- aplicar autorização sem confiar em caminhos “adivinháveis”

## Policies (exemplos) — acesso por usuário

### 1) Bucket privado com “pastas por usuário”

Convenção: `path` começa com `${auth.uid()}/...`

```sql
-- IMPORTANTE: ajuste o bucket conforme o seu
-- Buckets e objetos ficam em storage.buckets e storage.objects

-- Leitura (download/list) só do próprio prefixo
create policy "storage_private_select_own_prefix"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'private-images'
  and (name like auth.uid()::text || '/%')
);

-- Upload (insert) só no próprio prefixo
create policy "storage_private_insert_own_prefix"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'private-images'
  and (name like auth.uid()::text || '/%')
);

-- Update/delete (opcional) só do próprio prefixo
create policy "storage_private_update_own_prefix"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'private-images'
  and (name like auth.uid()::text || '/%')
)
with check (
  bucket_id = 'private-images'
  and (name like auth.uid()::text || '/%')
);

create policy "storage_private_delete_own_prefix"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'private-images'
  and (name like auth.uid()::text || '/%')
);
```

Notas:

- `name` em `storage.objects` é o **path** do arquivo (ex.: `userId/uuid.webp`).
- Se você usar multi-tenant, prefira `tenantId/userId/...` e policies mais fortes (abaixo).

## Policies (exemplos) — multi-tenant (prefixo por tenant)

Convenção: `name` começa com `${tenantId}/...`.

O padrão robusto é: **validar membership do usuário no tenant** via tabela de membership e usar isso na policy.

Exemplo conceitual (ajuste nomes/colunas):

```sql
-- Exemplo: tabela membership
-- create table public.tenant_members (tenant_id text, user_id uuid, primary key (tenant_id, user_id));

create policy "storage_select_by_tenant_membership"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'tenant-private'
  and exists (
    select 1
    from public.tenant_members tm
    where tm.user_id = auth.uid()
      and (storage.objects.name like tm.tenant_id || '/%')
  )
);
```

## Exibição de imagens privadas: opções

### Opção A) Signed URL (recomendado por padrão)

- Prós: simples, escalável, evita carregar a API do app.
- Contras: URL expira; você precisa renovar/reatualizar no client quando expirar.

Use `createSignedUrl(path, expiresIn)`.

### Opção B) Proxy no servidor (rota de imagem / mini-CDN)

Use quando você precisa:

- “URL estável” (rota do seu app), ou
- aplicar controle adicional (ex.: watermark, resize), ou
- contornar limitações do runtime (ex.: tamanho de resposta em rotas tradicionais).

Referência:

- `activenode/supabase-nextjs-image-api` — `https://github.com/activenode/supabase-nextjs-image-api?utm_source=chatgpt.com`

## Upload com progresso (Uppy)

Quando for necessário UX de progresso/retry:

- Uppy (Dashboard/DragDrop) no client
- integração de upload compatível com seu modelo de autorização (bucket público/policy, signed upload URL, ou rota server)

Referências:

- `yyassif/uppy-supabase-nextjs` — `https://github.com/yyassif/uppy-supabase-nextjs?utm_source=chatgpt.com`
- `madzalo/supabase-file-upload` — `https://github.com/madzalo/supabase-file-upload?utm_source=chatgpt.com`

## Anti-padrões (evitar)

- Confiar em “path secreto” como autorização (segurança por obscuridade).
- Expor `service_role` no client (bypassa RLS e vaza acesso total).
- Para bucket privado: tentar tratar como “link direto eterno”.
