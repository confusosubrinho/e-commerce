

# Fix: Dados Não Sendo Extraídos da Resposta Yampi

## Diagnóstico

Os logs mostram que o pedido **é encontrado** na Yampi (GET 200), mas após a sincronização:
- `payment_method` = null
- `gateway` = null  
- `shipping_method` = null
- `order_items` = "Produto" genérico, sem SKU/imagem/variante

Há **dois problemas confirmados**:

### 1. Data no formato objeto (não string)
O log mostra que `created_at` da Yampi vem como **objeto**, não string:
```json
{ "date": "2026-03-03 10:59:26.000000", "timezone_type": 3, "timezone": "America/Sao_Paulo" }
```
O código tenta `new Date(objeto)` → Invalid Date → ignora.

### 2. Campos provavelmente com nomes/estruturas diferentes
A API Yampi tem nomes de campos que podem variar (`payment` vs `payment_method`, `shipments.data` vs `shipping_option`). Sem log do payload real, estamos adivinhando. O código precisa:
- Logar o payload completo da Yampi (JSON) para debug
- Expandir extração para cobrir mais variantes de campo

## Correções no `yampi-sync-order-status/index.ts`

### 1. Corrigir parsing de data (formato objeto Yampi)
```typescript
// Se created_at é objeto {date: "...", timezone, timezone_type}
if (typeof yampiOrderDate === "object" && yampiOrderDate?.date) {
  yampiCreatedAt = new Date(yampiOrderDate.date).toISOString();
}
```

### 2. Adicionar log completo do payload Yampi
Após encontrar o pedido, logar as chaves e sub-objetos relevantes para entender a estrutura real:
```typescript
console.log("[yampi-sync] Yampi payload keys:", Object.keys(yampiOrder));
console.log("[yampi-sync] transactions:", JSON.stringify(transactions).slice(0, 500));
console.log("[yampi-sync] items:", JSON.stringify(yampiItems).slice(0, 500));
console.log("[yampi-sync] shipping_option:", JSON.stringify(yampiOrder.shipping_option));
```

### 3. Expandir extração de método de pagamento
A Yampi pode retornar `transactions.data[0].payment` ou `transactions.data[0].payment_method` como objeto com `.name`:
```typescript
const txPaymentMethod = 
  firstTx.payment_method?.name || firstTx.payment_method ||
  firstTx.payment?.name || firstTx.payment ||
  yampiOrder.payment_method?.name || yampiOrder.payment_method;
```

### 4. Expandir extração de método de envio
Yampi usa `shipments.data[0]` ou `shipping_address.data.shipment`:
```typescript
const shippingMethodName = 
  yampiOrder.shipments?.data?.[0]?.service_name ||
  yampiOrder.shipping_option_name || 
  yampiOrder.shipping_option?.name ||
  yampiOrder.delivery_option?.name;
```

### 5. Expandir extração de items
Yampi items podem ter `item_sku` ou `sku.data.sku` (mais aninhado). Adicionar mais fallbacks e logar item raw.

### 6. Melhorar match de order_items existentes
Quando `yampi_sku_id` não bate, tentar match por posição (index) dos items existentes.

## Arquivo modificado
- `supabase/functions/yampi-sync-order-status/index.ts`

