

## Bling Integration — Round 5: Bugs & Melhorias SaaS

### Bug 1 (Médio): `bling-oauth` usa `getClaims()` que pode não existir em todas as versões do SDK

Na linha 109 de `bling-oauth`, a autenticação usa `userClient.auth.getClaims(token)`. Este método não existe em versões estáveis do `@supabase/supabase-js`. O `bling-sync` e `bling-sync-single-stock` usam `userClient.auth.getUser()` corretamente. Se o runtime do Deno estiver com uma versão do SDK que não tem `getClaims`, o POST inteiro falha com erro 500.

**Fix**: Substituir `getClaims` por `userClient.auth.getUser()` em `bling-oauth`, alinhando com o padrão dos outros módulos.

---

### Bug 2 (Médio): `hasRecentLocalMovements` não detecta movimentações do tipo `refund`

A função `hasRecentLocalMovements` filtra apenas tipos `debit` e `reserve`. Porém, quando um pedido é cancelado (`cancel_order_return_stock`), o tipo registrado é `refund`. Se um admin cancela um pedido e imediatamente depois o cron do Bling roda, o Bling pode sobrescrever o estoque restaurado, porque o `refund` não é considerado "movimento recente". O estoque volta a decrementar erroneamente.

**Fix**: Adicionar `refund` ao filtro `.in("type", ["debit", "reserve", "refund"])`.

---

### Bug 3 (Médio): `dynamic import` repetido de `blingStockPush.ts` em loops — performance degradada

Em `bling-webhook` e `bling-sync`, `hasRecentLocalMovements` é importada via `await import("../_shared/blingStockPush.ts")` **dentro de loops**. A cada iteração (centenas de vezes no cron), o módulo é re-importado dinamicamente. Embora o runtime do Deno faça cache de módulos, a chamada assíncrona adicional em cada iteração adiciona overhead desnecessário.

**Fix**: Importar `hasRecentLocalMovements` no topo do arquivo com import estático, como já é feito com `fetchWithRateLimit` e `getValidTokenSafe`.

---

### Bug 4 (Baixo): SKU fallback no webhook não verifica `hasRecentLocalMovements`

Na função `updateStockForBlingId` (linhas 210-236 de `bling-webhook`), o path de fallback por SKU atualiza o estoque diretamente (`await supabase.from("product_variants").update({ stock_quantity: newStock })`) sem verificar movimentos locais recentes. Todos os outros paths de atualização de estoque passam pela verificação, mas este não.

**Fix**: Adicionar a mesma verificação `hasRecentLocalMovements` antes da atualização no SKU fallback.

---

### Bug 5 (Baixo): `upsertParentWithVariants` deleta variantes orfãs sem verificar `order_items`

Na linha 482-483 de `bling-sync`, variantes que não existem mais no Bling são deletadas (`DELETE`). Porém, se essas variantes estão referenciadas em `order_items.product_variant_id`, o delete pode falhar silenciosamente (FK constraint) ou, se não houver FK, os pedidos ficam com referências quebradas.

**Fix**: Antes de deletar, verificar se a variante está referenciada em `order_items`. Se estiver, apenas desativar (`is_active = false`) em vez de deletar.

---

### Bug 6 (Baixo): `createOrder` no `bling-sync` não inclui `customer_cpf` na query

A função `createOrder` (linha 798) busca `orders.*` mas usa `order.notes` para extrair CPF com regex. Porém a coluna `customer_cpf` existe na tabela `orders` (usada em `blingStockPush.ts` linha 87). O `select("*, order_items(*)")` inclui `customer_cpf` por padrão, mas a lógica de extração primeiro tenta o campo `notes` em vez de usar diretamente `order.customer_cpf`.

**Fix**: Usar `order.customer_cpf` como fonte primária, com fallback para regex no `notes`. Já está correto em `blingStockPush.ts`, alinhar `bling-sync`.

---

### Melhoria 1: `getSyncConfig` duplicada em `bling-sync` e `bling-webhook`

A função `getSyncConfig` é idêntica nos dois arquivos (linhas 55-71 em ambos). Qualquer alteração no schema do `bling_sync_config` precisa ser replicada manualmente.

**Fix**: Extrair `getSyncConfig` para `_shared/bling-sync-fields.ts` onde já estão os tipos e defaults.

---

### Melhoria 2: Registrar `inventory_movements` quando cron/webhook atualiza estoque

Quando o cron ou webhook do Bling atualiza o estoque local, nenhuma entrada é registrada em `inventory_movements`. Isso cria um gap na auditoria — o `stock_history` trigger captura a mudança em `product_variants`, mas não há como saber se a mudança veio do Bling, de uma venda, ou de ajuste manual.

**Fix**: Após cada atualização de estoque vinda do Bling, inserir `inventory_movements` com `type: "bling_sync"` e `quantity` = diferença. Isso também permite que a auditoria mostre a origem da mudança.

---

### Melhoria 3: Timeout do cron pode causar sync incompleta sem indicação

O cron `batchStockSync` processa todos os Bling IDs sequencialmente. Com 688 IDs (como mostram os logs), se o edge function timeout (padrão 60s para Lovable Cloud) for atingido, a sync para silenciosamente sem registrar o run em `bling_sync_runs` e sem marcar os produtos restantes.

**Fix**: Adicionar uma verificação de tempo decorrido no loop. Se estiver perto do limite (ex: 50s), parar o loop, registrar o run parcial, e logar quantos IDs ficaram pendentes.

---

### Arquivos a Modificar

1. **`supabase/functions/bling-oauth/index.ts`** — Substituir `getClaims` por `getUser`
2. **`supabase/functions/_shared/blingStockPush.ts`** — Adicionar `refund` ao filtro de `hasRecentLocalMovements`
3. **`supabase/functions/bling-webhook/index.ts`** — Import estático de `hasRecentLocalMovements`; verificação no SKU fallback; timeout guard no cron
4. **`supabase/functions/bling-sync/index.ts`** — Import estático; proteção contra delete de variantes com pedidos; alinhar CPF; timeout guard no syncStock
5. **`supabase/functions/_shared/bling-sync-fields.ts`** — Exportar `getSyncConfig` compartilhada

### Deploy
Redeploy: `bling-oauth`, `bling-webhook`, `bling-sync`

