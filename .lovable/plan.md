

# Bugs e Melhorias no Fluxo de Status — Yampi

## Bugs Encontrados

### Bug 1: `yampi-import-order` não mapeia status intermediários
**Arquivo:** `yampi-import-order/index.ts` linhas 240-245 e linhas 540-544

O mapeamento de status na importação manual/batch não inclui `processing`, `in_production`, `in_separation`, `ready_for_shipping`, `invoiced`. Esses status caem no `else` implícito e ficam como `"processing"` por acaso, mas o `paymentStatusMap` (linha 247-251) também não os cobre — resultando em `paymentStatus` inconsistente (cai no fallback genérico).

Na função batch (linha 566), o `payment_status` usa um ternário simples que não diferencia esses status intermediários.

### Bug 2: Cancelamento no webhook não atualiza `payment_status`
**Arquivo:** `yampi-webhook/index.ts` linha 713

Quando o webhook cancela um pedido, ele faz `update({ status: "cancelled" })` mas **não atualiza `payment_status`**. O `payment_status` do pedido fica como `"approved"` ou `"pending"`, criando inconsistência. Só a tabela `payments` é atualizada com o status correto. O campo `payment_status` na tabela `orders` fica desatualizado.

### Bug 3: Refund não restaura estoque
**Arquivo:** `yampi-webhook/index.ts` linhas 552-607

O bloco de refund atualiza `payment_status` para `"refunded"` e cancela pedidos pendentes, mas **nunca restaura estoque**. Se um pedido `processing` recebe refund, o estoque permanece debitado mesmo com o pagamento reembolsado. Diferente do bloco de cancelamento (linhas 715-740) que faz `increment_stock`.

### Bug 4: Shipped event não atualiza `payment_status`
**Arquivo:** `yampi-webhook/index.ts` linhas 634-647

O bloco de shipped atualiza `status: "shipped"` e `tracking_code`, mas não garante que `payment_status` seja `"approved"`. Se o pedido foi criado com `payment_status: "pending"` e a Yampi envia shipped sem enviar approved primeiro, o pedido fica como `shipped` com `payment_status: "pending"`.

### Bug 5: `yampi-sync-order-status` sobrescreve `payment_status` com `"refunded"` mas não restaura estoque
**Arquivo:** `yampi-sync-order-status/index.ts` linha 141

Quando `yampiStatus === "refunded"`, o `localStatus` vira `"cancelled"` e dispara `cancel_order_return_stock`. Isso é correto para reembolso total, mas deveria manter `localStatus` como o status atual se for parcial. Não há como diferenciar reembolso parcial vs total nesta função.

### Bug 6: `order.status.updated` com status `"paid"` no webhook cria pedido duplicado se já processado como `"pending"`
**Arquivo:** `yampi-webhook/index.ts` linhas 94-110

A verificação de duplicata por `external_reference` (linha 98) retorna cedo se o pedido já existe com qualquer status, incluindo `"pending"`. Mas a busca por `sessionId` (linha 113) poderia encontrar outro pedido pendente criado pelo checkout-router. Cenário de race condition: dois webhooks chegam quase simultaneamente — o hash de idempotência (linha 74-84) mitiga, mas o hash usa `transactionId || Date.now()`, e se dois eventos diferentes (ex.: `payment.approved` e `order.status.updated` com `paid`) chegam com `transactionId` diferente ou nulo, ambos passam.

---

## Plano de Correções

### Correção 1: Completar mapeamento em `yampi-import-order`
Adicionar status intermediários (`processing`, `in_production`, `in_separation`, `ready_for_shipping`, `invoiced`) ao mapeamento de status e `paymentStatusMap` — tanto no import single quanto no batch.

### Correção 2: Atualizar `payment_status` no cancelamento via webhook
No bloco de cancelamento (linha 713), incluir `payment_status: cancelledPaymentStatus` no update do pedido, não apenas na tabela `payments`.

### Correção 3: Restaurar estoque no refund quando pedido não é pendente
No bloco de refund, quando o pedido tem status `processing` (já debitou estoque), fazer `increment_stock` para cada item, similar ao que o bloco de cancelamento faz.

### Correção 4: Garantir `payment_status: "approved"` no shipped
No bloco de shipped, adicionar `payment_status: "approved"` ao update se o pedido atual tiver `payment_status !== "approved"`.

### Correção 5: Melhorar hash de idempotência no approved
Usar `yampiOrderId` como componente principal do hash em vez de `transactionId || Date.now()` para garantir que dois eventos referentes ao mesmo pedido Yampi sejam detectados como duplicatas.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/yampi-webhook/index.ts` | Fix #2 (payment_status no cancel), #3 (estoque no refund), #4 (payment_status no shipped), #5 (hash idempotência) |
| `supabase/functions/yampi-import-order/index.ts` | Fix #1 (mapeamento status intermediários) |
| `supabase/functions/yampi-sync-order-status/index.ts` | Nenhuma mudança necessária (já corrigido na iteração anterior) |

