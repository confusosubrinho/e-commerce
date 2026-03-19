# Exemplos — Multi-tenant com tenant_id + RLS (Supabase/Postgres)

## 1) Tabelas base: tenants + membership

```sql
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member', -- ex.: owner|admin|member
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index if not exists tenant_members_user_id_idx
  on public.tenant_members(user_id);
```

## 2) Helper de autorização (recomendado): função is_member(tenant_id)

> Melhora legibilidade das policies e reduz duplicação.

```sql
create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = auth.uid()
  );
$$;
```

## 3) Exemplo de tabela tenant-scoped: products

```sql
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  price_cents int not null check (price_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_tenant_id_idx on public.products(tenant_id);
```

## 4) RLS: negar por padrão + policies por operação

```sql
alter table public.products enable row level security;

-- SELECT: só membros do tenant do registro
create policy "products_select_by_tenant"
on public.products
for select
to authenticated
using (public.is_tenant_member(tenant_id));

-- INSERT: força que o registro seja criado no tenant em que o user é membro
create policy "products_insert_by_tenant"
on public.products
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

-- UPDATE: só atualiza dentro do tenant e mantém tenant_id consistente
create policy "products_update_by_tenant"
on public.products
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

-- DELETE: só membros do tenant do registro
create policy "products_delete_by_tenant"
on public.products
for delete
to authenticated
using (public.is_tenant_member(tenant_id));
```

## 5) Template rápido para “quase todas” as tabelas tenant-scoped

> Substitua: `public.<table>` e ajuste o nome das policies.

```sql
alter table public.<table> enable row level security;

create policy "<table>_select_by_tenant"
on public.<table>
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy "<table>_insert_by_tenant"
on public.<table>
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy "<table>_update_by_tenant"
on public.<table>
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy "<table>_delete_by_tenant"
on public.<table>
for delete
to authenticated
using (public.is_tenant_member(tenant_id));
```

## 6) Validação cross-tenant (exemplo: order_items referenciando products)

Quando uma tabela referencia outra, evite inconsistência “produto de outro tenant”.
Aqui vai um padrão comum:

```sql
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty int not null check (qty > 0),
  created_at timestamptz not null default now()
);

create index if not exists order_items_tenant_id_idx on public.order_items(tenant_id);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
```

Agora, garanta o alinhamento de tenant via constraint (com trigger) **ou** valide no backend.
Se quiser enforce no DB via trigger:

```sql
create or replace function public.enforce_order_item_tenant_match()
returns trigger
language plpgsql
as $$
declare
  v_order_tenant uuid;
  v_product_tenant uuid;
begin
  select tenant_id into v_order_tenant from public.orders where id = new.order_id;
  select tenant_id into v_product_tenant from public.products where id = new.product_id;

  if v_order_tenant is null then
    raise exception 'order not found';
  end if;

  if v_product_tenant is null then
    raise exception 'product not found';
  end if;

  if new.tenant_id <> v_order_tenant or new.tenant_id <> v_product_tenant then
    raise exception 'cross-tenant reference blocked';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_order_items_tenant_match on public.order_items;
create trigger trg_order_items_tenant_match
before insert or update on public.order_items
for each row execute function public.enforce_order_item_tenant_match();
```

