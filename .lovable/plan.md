

# Correção de Riscos de Segurança — RLS e RBAC

## Riscos Identificados

### 1. CRÍTICO — `stock_notifications` SELECT vaza dados para qualquer usuário
A policy `"Users can view own notifications"` usa `USING (email IS NOT NULL)` — isso permite que **qualquer pessoa** (incluindo anônimos) veja **todas** as notificações que tenham email preenchido. Deveria filtrar por email do usuário autenticado.

### 2. MÉDIO — Policies de INSERT/UPDATE permissivas demais
Tabelas com `WITH CHECK (true)` ou `USING (true)` que permitem **qualquer usuário autenticado** (não apenas service role) inserir/atualizar:
- `inventory_movements` — INSERT WITH CHECK (true)
- `variation_value_map` — INSERT WITH CHECK (true), UPDATE USING (true)
- `catalog_sync_runs` — INSERT WITH CHECK (true), UPDATE USING (true)
- `cleanup_runs` — INSERT WITH CHECK (true), UPDATE USING (true)
- `appmax_tokens_cache` — INSERT WITH CHECK (true), UPDATE USING (true)
- `appmax_logs` — INSERT WITH CHECK (true)
- `log_daily_stats` — INSERT WITH CHECK (true)

Essas policies existem para edge functions (service role), mas o `WITH CHECK (true)` também permite que o anon key insira dados — um risco de poluição de dados.

### 3. MÉDIO — `admin_members` sem restrição por role owner
Qualquer admin pode gerenciar membros da equipe via `is_admin()`. Deveria ser restrito a owners.

## Correções Planejadas

### Migration SQL única com todas as correções:

**1. Fix `stock_notifications` SELECT** — Remover a policy quebrada. Manter apenas admin SELECT via `FOR ALL`.

**2. Restringir INSERT/UPDATE "service-only"** — Substituir `WITH CHECK (true)` por `WITH CHECK (is_admin())` nas tabelas: `inventory_movements`, `variation_value_map`, `catalog_sync_runs`, `cleanup_runs`, `appmax_tokens_cache`, `appmax_logs`, `log_daily_stats`. Edge functions usam service_role key que bypassa RLS, então isso não quebra nada.

**3. Restringir `admin_members`** — Criar uma function `is_owner()` que verifica se o usuário é owner (via `admin_members` role='owner' OU primeiro admin em `user_roles`), e usar na policy de ALL da `admin_members`.

## Arquivos Modificados

- **1 migration SQL** com todos os DROP/CREATE POLICY

## Sem alteração de código frontend
As edge functions usam service_role (bypassa RLS). O frontend admin já usa sessões autenticadas com role admin. Nenhuma query do frontend será quebrada.

