

## Bling Integration — Round 7: Bugs & Melhorias SaaS

### Bug 1 (Médio): `variationItems` path no `upsertParentWithVariants` não verifica `hasRecentLocalMovements`

Em `bling-sync` linhas 446-449, quando variantes de listagem (variation items) já existem no banco e são atualizadas, o `stock_quantity` é sobrescrito diretamente sem verificar movimentos recentes. Diferente do path de `parentDetail.variacoes` (linhas 396-403) que foi corrigido nos rounds anteriores, este path paralelo de variation items permanece desprotegido.

**Fix**: Adicionar `hasRecentLocalMovements` check antes de atualizar `stock_quantity` no path de `variationItems` (linhas 446-449).

---

### Bug 2 (Médio): Default "Único" variant não verifica `hasRecentLocalMovements` antes de atualizar estoque

Em `bling-sync` linhas 466-467, quando o produto não tem variações e a variante "Único" já existe, o estoque é atualizado diretamente sem verificar movimentos recentes. Se uma venda acabou de ocorrer nessa variante, o Bling pode sobrescrever o estoque.

**Fix**: Adicionar `hasRecentLocalMovements` check antes de atualizar o estoque da variante "Único" existente.

---

### Bug 3 (Médio): `syncStockOnly` no `bling-webhook` não registra `inventory_movements`

A função `syncStockOnly` (linhas 370-422 de `bling-webhook`) atualiza estoque em dois paths (variacoes e no-variation) mas não registra entradas em `inventory_movements`. Enquanto `updateStockForBlingId` e `batchStockSync` foram corrigidos nos rounds anteriores para registrar movimentações, `syncStockOnly` permanece sem auditoria. Isso afeta os webhooks de produtos multi-variantes.

**Fix**: Após cada update de estoque em `syncStockOnly`, buscar o estoque anterior e inserir em `inventory_movements` com `type: "bling_sync"`.

---

### Bug 4 (Baixo): Single-variant product path em `updateStockForBlingId` não registra `inventory_movements`

Em `bling-webhook` linhas 181-196, quando um produto com uma única variante é atualizado via webhook, o estoque é atualizado mas nenhuma entrada de `inventory_movements` é criada. O path de variante direta (linhas 137-144) e o `batchStockSync` registram, mas este path não.

**Fix**: Adicionar registro de `inventory_movements` no path de single-variant product.

---

### Bug 5 (Baixo): `bling-oauth` callback não verifica se `code` já foi utilizado

No `bling-oauth` callback (linhas 24-89), se o browser enviar o mesmo `code` duas vezes (ex: refresh da página), o Bling rejeitará com erro mas a mensagem exibida será genérica. Não há proteção contra re-processamento.

**Fix**: Adicionar verificação de `state` parameter usando armazenamento temporário. Como alternativa mais simples, tratar melhor a mensagem de erro quando o código já foi consumido.

---

### Bug 6 (Baixo): `relink_variants` não registra `inventory_movements` quando atualiza estoque

Em `bling-sync` linhas 1026-1033, o `relink_variants` atualiza `stock_quantity` mas não registra a movimentação. Isso cria um gap na auditoria.

**Fix**: Registrar `inventory_movements` com `type: "bling_sync"` ao atualizar estoque no relink.

---

### Melhoria 1: `hasRecentLocalMovements` não inclui tipo `bling_sync` — pode causar loops

A função `hasRecentLocalMovements` (linhas 232-247 de `blingStockPush.ts`) filtra tipos `["debit", "reserve", "refund"]` mas não inclui `"bling_sync"`. Isso é correto — movimentos do próprio Bling não devem bloquear futuras syncs. Porém, se duas execuções do cron acontecem dentro de 10 minutos, a segunda pode reprocessar tudo porque o tipo `bling_sync` não bloqueia. Isso é desperdício mas não é bug — manter como está. **Nenhuma ação necessária.**

---

### Melhoria 2: Logs do webhook de estoque `syncStockOnly` não identificam o tipo `bling_sync` na auditoria

Quando o webhook processa um evento de estoque para produtos multi-variantes via `syncStockOnly`, não há registro em `inventory_movements`. Isso já está coberto pelo Bug 3 acima.

---

### Melhoria 3: Token refresh em `getValidTokenSafe` não verifica `updateResult` count

Em `blingTokenRefresh.ts` linha 60-68, após o `update` com optimistic lock, o código verifica `updateError` mas não verifica se alguma row foi efetivamente atualizada. Se o `eq("bling_refresh_token", oldRefreshToken)` não bater nenhuma row (outro processo já atualizou), o `updateResult` terá 0 rows updated mas nenhum erro. O token retornado é válido para esta request mas o novo refresh_token é perdido.

**Fix**: Verificar `updateResult?.length === 0` ou o `count` para detectar se o optimistic lock falhou. Se falhou, re-ler o token atualizado e retornar o mais recente.

---

### Melhoria 4: `save_sync_config` action ausente no `bling-sync`

O `BlingSyncConfigPanel` no frontend (Integrations.tsx linhas 1293-1301) salva configurações diretamente via Supabase client. Isso funciona graças ao RLS, mas significa que a validação é feita apenas no frontend. Um admin pode enviar configurações inválidas. Para SaaS de alto nível, a atualização deveria passar pela edge function com validação.

**Fix**: Adicionar action `save_sync_config` no `bling-sync` com validação de tipos booleanos.

---

### Arquivos a Modificar

1. **`supabase/functions/bling-sync/index.ts`** — Proteger variation items path e "Único" variant com `hasRecentLocalMovements`; registrar `inventory_movements` no `relink_variants`
2. **`supabase/functions/bling-webhook/index.ts`** — Registrar `inventory_movements` no `syncStockOnly` e no single-variant path de `updateStockForBlingId`
3. **`supabase/functions/_shared/blingTokenRefresh.ts`** — Verificar resultado do optimistic lock e re-ler token se necessário

### Deploy
Redeploy: `bling-sync`, `bling-webhook`

