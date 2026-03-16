# Mudanças de banco de dados – Fases 1 a 7

Este documento garante que **todas** as alterações necessárias no banco de dados das Fases 1 a 7 do ROADMAP estão nas migrations do Supabase e descreve em detalhe o que cada uma faz e como aplicar.

---

## Resumo por fase

| Fase | Nome                    | Mudanças no banco? | Arquivo(s) de migration |
|------|-------------------------|--------------------|-------------------------|
| 1    | Documentação e fundação | **Não**            | —                       |
| 2    | Qualidade de código     | **Não**            | —                       |
| 3    | Padrão Edge Functions  | **Não**            | —                       |
| 4    | Testes e CI             | **Não**            | —                       |
| 5    | Super Admin             | **Sim**            | `20260316000000_super_admin_role.sql` |
| 6    | Performance e UX        | **Não**            | —                       |
| 7    | Multi-tenant            | **Sim**            | `20260316100000_multi_tenant_schema.sql`<br>`20260317100000_multi_tenant_rls.sql` |

Ou seja: **só as Fases 5 e 7** exigem mudanças no banco. Todas estão nos arquivos listados abaixo.

---

## Fase 5 – Super Admin

### Arquivo

- `supabase/migrations/20260316000000_super_admin_role.sql`

### O que essa migration faz (detalhes)

1. **Remove** o constraint antigo de `admin_members.role` (se existir):
   - `DROP CONSTRAINT IF EXISTS admin_members_role_check`
2. **Cria** o novo constraint permitindo o valor `super_admin`:
   - `CHECK (role IN ('owner', 'manager', 'operator', 'viewer', 'super_admin'))`
3. **Comentário** na coluna `role` explicando os papéis (owner, super_admin, etc.).

### O que fazer

- Aplicar essa migration junto com as demais (por timestamp). Não há passo manual obrigatório no banco.
- **Manual (após aplicar):** atribuir a role `super_admin` a um usuário em `admin_members` (via SQL ou futura UI em Equipe) para alguém acessar `/admin/super`.

---

## Fase 7 – Multi-tenant (schema)

### Arquivo

- `supabase/migrations/20260316100000_multi_tenant_schema.sql`

### O que essa migration faz (detalhes)

1. **Tabela `public.tenants`**
   - Colunas: `id` (PK), `name`, `slug` (UNIQUE), `domain` (UNIQUE), `active`, `created_at`.
   - RLS ativado.
   - Políticas: service_role tem acesso total; admins podem SELECT.
   - `GRANT SELECT ON public.tenants TO anon, authenticated` (para tenant discovery futuro).

2. **Tenant padrão**
   - Um único `INSERT` com `id = '00000000-0000-0000-0000-000000000001'`, `slug = 'default'`, `name = 'Loja padrão'`.
   - `ON CONFLICT (id) DO NOTHING` para poder reexecutar.

3. **Coluna `tenant_id` em 14 tabelas**
   - Tabelas: `categories`, `products`, `product_variants`, `product_images`, `banners`, `coupons`, `customers`, `store_settings`, `orders`, `order_items`, `payments`, `inventory_movements`, `integrations_checkout`, `integrations_checkout_providers`.
   - Para cada uma: `ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE`.

4. **Backfill**
   - Em cada uma das 14 tabelas: `UPDATE ... SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL`.

5. **NOT NULL e DEFAULT**
   - Em cada uma: `ALTER COLUMN tenant_id SET NOT NULL` e `SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid`.

6. **Índices**
   - `idx_categories_tenant_id`, `idx_products_tenant_id`, `idx_product_variants_tenant_id`, `idx_orders_tenant_id`, `idx_payments_tenant_id`.

### O que fazer

- Aplicar **antes** da migration de RLS (20260317100000). Ordem é garantida pelo timestamp do nome do arquivo.

---

## Fase 7 – Multi-tenant (RLS e funções)

### Arquivo

- `supabase/migrations/20260317100000_multi_tenant_rls.sql`

**Depende de:** `20260316100000_multi_tenant_schema.sql` (tabela `tenants` e coluna `tenant_id` já existirem).

### O que essa migration faz (detalhes)

1. **Tabela `public.user_tenants`**
   - Colunas: `user_id` (PK, FK auth.users), `tenant_id` (FK tenants).
   - RLS: usuário pode SELECT a própria linha; service_role e super_admin/owner podem gerir (ALL).
   - Backfill: insere em `user_tenants` um registro por `user_id` de `admin_members` e de `user_roles` (role = 'admin') com tenant padrão; `ON CONFLICT (user_id) DO NOTHING`.

2. **Trigger em `admin_members`**
   - Função: `fn_user_tenants_on_admin_member_insert()`.
   - Trigger: `trg_user_tenants_on_admin_member_insert` AFTER INSERT em `admin_members`.
   - Efeito: todo novo admin ganha linha em `user_tenants` com tenant padrão.

3. **Função `public.get_current_tenant_id()`**
   - Retorna `tenant_id` de `user_tenants` para `auth.uid()` ou, se não houver linha, o UUID do tenant padrão.
   - STABLE, SECURITY DEFINER, search_path = public.

4. **Função `public.is_super_admin()`**
   - Retorna true se existir em `admin_members` um registro com `user_id = auth.uid()`, `role IN ('super_admin', 'owner')` e `is_active = true`.
   - Usada nas políticas para permitir bypass do filtro por tenant.

5. **Políticas RLS por tenant (14 tabelas)**
   - Para cada tabela com `tenant_id`: remove políticas antigas (DROP POLICY IF EXISTS) e cria novas que:
     - Filtram por `tenant_id = get_current_tenant_id()` ou `is_super_admin()` ou `(auth.jwt() ->> 'role') = 'service_role'`.
     - Mantêm regras de negócio (ex.: usuário vê só seus pedidos, anon vê só cupons ativos, etc.).
   - Tabelas: `categories`, `products`, `product_variants`, `product_images`, `banners`, `coupons`, `customers`, `store_settings`, `orders`, `order_items`, `payments`, `inventory_movements`, `integrations_checkout`, `integrations_checkout_providers`.
   - Em `store_settings`: política extra para leitura pública apenas do tenant padrão (para a view `store_settings_public`).
   - Em `orders` / `order_items` / `payments`: políticas específicas para INSERT/UPDATE por service_role e para usuário ver só seus dados no tenant correto.

### O que fazer

- Aplicar **depois** de `20260316100000_multi_tenant_schema.sql`.
- Nenhum passo manual obrigatório no banco; novos admins passam a ganhar linha em `user_tenants` via trigger.

---

## Ordem de aplicação e como rodar

As migrations são aplicadas **por ordem de timestamp** do nome do arquivo. A ordem correta das que tocam nas Fases 1–7 é:

1. `20260316000000_super_admin_role.sql` (Fase 5)
2. `20260316100000_multi_tenant_schema.sql` (Fase 7 – schema)
3. `20260317100000_multi_tenant_rls.sql` (Fase 7 – RLS)

### Como aplicar

- **Projeto linkado ao Supabase remoto:**  
  `supabase db push`  
  (aplica todas as migrations pendentes na ordem acima).

- **Banco local (Docker rodando):**  
  `supabase db reset`  
  (recria o banco e aplica todas as migrations desde o início).

- **Sem link e sem Docker:**  
  Os arquivos ficam em `supabase/migrations/`. Quando tiver ambiente (link ou Docker), rodar um dos comandos acima.

### Após aplicar

- **Fase 5:** Atribuir `role = 'super_admin'` a um usuário em `admin_members` (SQL ou UI) para acesso a `/admin/super`.
- **Fase 7:** Nenhum passo obrigatório; opcionalmente conferir loja (anon), admin e Super Admin após aplicar.

---

## Garantia

Todas as mudanças de banco de dados necessárias para as **Fases 1 a 7** do ROADMAP estão contidas nos arquivos de migration acima. Não há alterações de banco das Fases 1–7 fora desses três arquivos. Para qualquer nova mudança de banco a partir da Fase 8, criar novas migrations e, se fizer sentido, atualizar este documento.
