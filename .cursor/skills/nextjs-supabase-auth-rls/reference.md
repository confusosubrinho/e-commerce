# Referência — Next.js + Supabase Auth + RLS

## Quando usar Service Role

Use `SUPABASE_SERVICE_ROLE_KEY` **somente** em ambientes server-side controlados (ex.: jobs/admin, webhooks, migrations). Service Role **bypassa RLS**.

Checklist antes de usar:

- Precisa mesmo bypassar RLS? (admin/backoffice, manutenção, auditoria)
- Se bypassar, você implementou autorização explícita no código?
- Você garantiu que esse caminho não é atingível pelo usuário comum?

## Design de tabelas para RLS

Padrões comuns:

- **“Ownership” direto**: tabela tem `user_id uuid not null references auth.users(id)`
- **“Owner = primary key”**: `id uuid primary key references auth.users(id)` (bom para `profiles`)
- **Multi-tenant**: `org_id` + tabela de membership; policies baseadas em membership

## Funções úteis do Supabase (Postgres)

- `auth.uid()` → `uuid` do usuário autenticado (JWT)
- `auth.role()` → papel (ex.: `authenticated`, `anon`)

## Política de negação por padrão (boa prática)

1. `alter table ... enable row level security;`
2. **Não criar policy** até ter clareza
3. Criar policies explícitas por operação

## Policies — guias práticos

### SELECT

Se o usuário só pode ver “seus” registros:

```sql
create policy "select_own"
on public.items
for select
to authenticated
using (user_id = auth.uid());
```

### INSERT

Garanta que a pessoa só insere com `user_id = auth.uid()`:

```sql
create policy "insert_own"
on public.items
for insert
to authenticated
with check (user_id = auth.uid());
```

### UPDATE

Combine `using` (quais linhas pode atualizar) e `with check` (como a linha fica depois):

```sql
create policy "update_own"
on public.items
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
```

### DELETE

```sql
create policy "delete_own"
on public.items
for delete
to authenticated
using (user_id = auth.uid());
```

## Next.js App Router + @supabase/ssr (conceito)

- No **middleware**, o objetivo é **manter os cookies de sessão atualizados** (refresh) e, se quiser, **redirecionar** rotas privadas.
- No **server**, o Supabase client deve ler/escrever cookies via `next/headers`.
- No **client**, use o client do browser apenas para UI reativa (ex.: login form), nunca para autorização.

