

# Fix: Sincronização de Pedido Yampi Não Encontra o Pedido

## Problema Raiz

A função `yampi-sync-order-status` usa 3 estratégias para localizar o pedido na API Yampi, mas todas podem falhar:

1. **Busca por `q=` (search)**: O parâmetro `q` da API Yampi busca por **nome/email do cliente**, NÃO por ID do pedido. Buscar `q=156943794` não retorna nada.
2. **Busca por `yampi_order_number`**: No banco, este campo está `null` para o pedido em questão, então este passo é pulado.
3. **GET direto `/orders/{id}`**: Este deveria funcionar, mas a resposta pode ter formato `{ data: { ... } }` que o código não valida corretamente — ele faz fallback para `json` inteiro se `json.data` é null.

Além disso, o pedido atual (`VAN20260305001036`) tem `external_reference: 156943794` que é provavelmente o **Yampi link ID** (do checkout-router, linha 384), não o ID do pedido Yampi. Isso significa que nenhuma das buscas vai encontrar o pedido correto.

## Correção no `yampi-sync-order-status/index.ts`

### 1. Priorizar GET direto por ID (mais confiável)
Inverter a ordem: tentar GET direto `/orders/{external_reference}` **primeiro**, antes da busca por `q=`.

### 2. Adicionar busca pelo número do pedido via endpoint específico
Após falhar por ID, tentar buscar por `number` usando o endpoint de busca com filtro `number={value}` em vez do `q=` genérico.

### 3. Adicionar busca por `order_number` do banco local
O `order_number` local (ex: `VAN20260305001036`) pode não ser o mesmo da Yampi, mas o `yampi_order_number` quando disponível sim.

### 4. Logar detalhes da busca para debug
Adicionar logs de console para cada tentativa, incluindo a resposta da API, para facilitar diagnóstico futuro.

### Lógica atualizada da função `fetchYampiOrder`:

```typescript
// 1) GET direto por ID (mais confiável)
async function fetchYampiOrderById(id: string) {
  const url = `${baseUrl}/orders/${id}?${includeQuery}`;
  const res = await fetchWithTimeout(url, { headers });
  if (!res.ok) { console.log("[yampi-sync] GET /orders/" + id + " → " + res.status); return null; }
  const json = await res.json();
  return (json?.data as Record<string, unknown>) || null;
}

// 2) Busca por number (filtro exato, não search genérico)
async function fetchYampiOrderByNumber(num: string) {
  const url = `${baseUrl}/orders?${includeQuery}&number=${encodeURIComponent(num)}&limit=1`;
  const res = await fetchWithTimeout(url, { headers });
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.data?.[0] as Record<string, unknown>) || null;
}
```

Ordem de tentativas:
1. GET direto por `external_reference`
2. GET direto por `yampi_order_number` (se diferente)
3. Busca por `number=external_reference`
4. Busca por `number=yampi_order_number`
5. Fallback: search `q=external_reference` (último recurso)

## Arquivo modificado
- `supabase/functions/yampi-sync-order-status/index.ts`

