# Exemplos (TypeScript) — Vite/React + Supabase Auth + RLS

## 0) Dependência (seu projeto já usa)

```bash
npm i @supabase/supabase-js
```

## 1) SQL (Postgres/Supabase) — tabela `profiles` + RLS

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());
```

Opcional: trigger de `updated_at`.

## 2) Variáveis de ambiente (Vite)

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Nunca expor:

```bash
SUPABASE_SERVICE_ROLE_KEY=...
```

## 3) Client Supabase (Vite) — centralize e reuse

No seu projeto, o client já existe em `src/integrations/supabase/client.ts`. Reuse assim:

```ts
import { supabase } from "@/integrations/supabase/client";
```

## 4) Guard de rota (React Router) — proteger páginas privadas

Você pode manter a checagem dentro da página (como já faz em `src/pages/MyAccount.tsx`) **ou** criar um guard reutilizável.

Ex.: `src/components/auth/RequireAuth.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      setHasUser(Boolean(session?.user));
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) return null;

  if (!hasUser) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
```

Uso (conceito) em `src/App.tsx`:

```tsx
// <Route path="/conta" element={<RequireAuth><MyAccount /></RequireAuth>} />
```

## 5) Consultar dados “do usuário” (RLS filtra)

Exemplo (perfil):

```ts
const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
```

Se você preferir expressar intenção no código, manter `.eq("user_id", user.id)` é ok — mas não substitui RLS.

---

## (Opcional) Next.js App Router + @supabase/ssr

Se/ quando você migrar para Next.js, use `@supabase/ssr` para lidar com cookies no server/middleware.

