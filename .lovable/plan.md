

## Diagnóstico Completo: Fluxo de Estoque Site → Bling → Devoluções

### Como funciona hoje

1. **Venda no site → Estoque local**: ✅ Funciona. O `decrement_stock` é chamado atomicamente durante o checkout (via `checkout-stripe-create-intent`, `checkout-process-payment`, ou `yampi-webhook`). O estoque é decrementado e registrado em `inventory_movements`.

2. **Estoque local → Bling**: ❌ **NÃO EXISTE**. Quando uma venda acontece no site, o estoque é decrementado localmente mas o Bling **nunca é notificado**. O fluxo `create_order` (que cria o pedido no Bling) é **manual** — o admin precisa clicar para enviar. E mesmo quando o pedido é criado no Bling, o Bling decrementa o estoque dele automaticamente (pelo pedido de venda), mas **somente se o admin disparar `create_order`**.

3. **Bling → Estoque local**: ✅ Funciona via webhooks e cron. O Bling envia webhooks de alteração de estoque, e o cron (`sync_stock`) puxa periodicamente. **Porém**, se o admin não criou o pedido no Bling, o estoque do Bling fica desatualizado e a próxima sincronização pode **sobrescrever** o estoque local com o valor errado do Bling.

4. **Devolução/Cancelamento → Bling**: ❌ **NÃO EXISTE**. Quando um pedido é cancelado localmente (via `cancel_order_return_stock`), o estoque local é restaurado mas nada é enviado ao Bling.

### Problemas Críticos Identificados

**Problema 1 (Crítico): Venda no site não atualiza estoque no Bling**
Se o admin não cria manualmente o pedido no Bling, o estoque do Bling fica com o valor antigo. Na próxima sincronização (cron ou webhook), o estoque local é sobrescrito pelo valor do Bling, "desfazendo" a venda.

**Problema 2 (Crítico): Cancelamento/devolução não notifica o Bling**
O `cancel_order_return_stock` restaura estoque localmente e registra `inventory_movements`, mas não faz nenhuma chamada ao Bling para ajustar o estoque lá.

**Problema 3 (Médio): `create_order` é apenas manual**
Não existe nenhum trigger automático para criar o pedido no Bling quando o pagamento é confirmado. O admin precisa ir ao painel e clicar manualmente.

### Plano de Correção

#### Fix 1: Atualizar estoque no Bling após venda (push local → Bling)
Criar uma função utilitária `pushStockToBling` que, dado um `variant_id` e a quantidade nova, faz PUT na API do Bling (`/estoques`) para atualizar o saldo. Chamar essa função nos webhooks de pagamento confirmado (`checkout-stripe-webhook`, `yampi-webhook` evento approved, `checkout-process-payment`).

**Alternativa mais simples e segura**: Em vez de fazer push individual, criar o pedido automaticamente no Bling quando o pagamento é confirmado. O Bling então decrementa o estoque dele automaticamente pelo pedido de venda.

#### Fix 2: Criar pedido no Bling automaticamente após pagamento confirmado
Adicionar chamada automática ao `create_order` do Bling nos webhooks de pagamento confirmado:
- `checkout-stripe-webhook` (evento `payment_intent.succeeded` / `checkout.session.completed`)
- `yampi-webhook` (evento `approved`)
- `checkout-process-payment` (após pagamento bem-sucedido)

Isso garante que o Bling recebe o pedido e decrementa o estoque dele.

#### Fix 3: Notificar Bling em cancelamento/devolução
No `admin-commerce-action` (ação `cancel_order`) e no RPC `cancel_order_return_stock`, após restaurar o estoque local, verificar se o pedido tem `bling_order_id` e:
- Cancelar o pedido no Bling via API (`PUT /pedidos/vendas/{id}/cancelar`)
- Ou ajustar o estoque via API (`POST /estoques`) se não houver pedido no Bling

#### Fix 4: Proteger sincronização contra sobrescrita
Na lógica de `syncStock` e no webhook de estoque do Bling, antes de sobrescrever o estoque local, verificar se há `inventory_movements` recentes (últimos 10 min) do tipo `debit` ou `reserve` para aquele variant. Se houver, **não sobrescrever** — o valor local é mais recente que o do Bling.

### Arquivos a Modificar

1. **`supabase/functions/bling-sync/index.ts`** — Exportar `createOrder` como função reutilizável; adicionar ação `update_bling_stock` e `cancel_bling_order`
2. **`supabase/functions/checkout-stripe-webhook/index.ts`** — Após confirmar pagamento, chamar `create_order` do Bling automaticamente
3. **`supabase/functions/checkout-process-payment/index.ts`** — Idem
4. **`supabase/functions/yampi-webhook/index.ts`** — No evento approved, chamar `create_order` do Bling
5. **`supabase/functions/admin-commerce-action/index.ts`** — Na ação de cancelamento, cancelar pedido no Bling
6. **`supabase/functions/bling-webhook/index.ts`** — Adicionar proteção contra sobrescrita de estoque recente
7. **`supabase/functions/_shared/blingStockPush.ts`** (novo) — Função compartilhada para criar pedido no Bling e/ou ajustar estoque

### Deploy
Redeploy: `bling-sync`, `bling-webhook`, `checkout-stripe-webhook`, `checkout-process-payment`, `yampi-webhook`, `admin-commerce-action`

