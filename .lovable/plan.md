

# Enriquecer order_items com nome do produto, variante e SKU

## Problema

Existem dois caminhos que criam/atualizam `order_items`:

### Caminho 1: `checkout-router` (pré-criação do pedido)
- **product_name**: salva corretamente (vem da tabela `products`)
- **variant_info**: sempre salvo como string vazia `""` (linha 299)
- **sku_snapshot**: **não é salvo** (ausente do insert, linhas 292-312)
- **image_snapshot**: sempre `null`

O `checkout-router` faz `select("id, product_id, base_price, sale_price, yampi_sku_id, products(base_price, sale_price, name)")` mas **não busca** `size`, `color`, nem `sku` da variante.

### Caminho 2: `yampi-webhook` (path de UPDATE, pedido já existe por session_id)
- Linhas 252-276: apenas converte reserves em debits de estoque
- **NÃO atualiza** os `order_items` com dados enriquecidos do webhook (nome, variante, SKU, imagem)
- Os items ficam com `variant_info: ""` e `sku_snapshot: null` para sempre

### Caminho 3: `yampi-webhook` (path de CREATE, pedido novo)
- Este caminho **já funciona bem** — extrai nome, variante, SKU e imagem corretamente (linhas 434-506)

## Correções

### Correção 1: `checkout-router` — buscar size/color/sku e salvar nos order_items
Alterar o `select` da query de variantes para incluir `size, color, sku`:
```
.select("id, product_id, base_price, sale_price, yampi_sku_id, size, color, sku, products(base_price, sale_price, name)")
```

Construir `variant_info` e `sku_snapshot` a partir desses campos e salvar no insert de `order_items`. Buscar também a imagem primária do produto.

### Correção 2: `yampi-webhook` (update path) — enriquecer order_items existentes
Após atualizar o pedido (linhas 252-276), iterar pelos `existingItems` e atualizar cada um com:
- `product_name` / `title_snapshot` do produto local (se disponível) ou do payload Yampi
- `variant_info` com size/color da variante local
- `sku_snapshot` com o SKU da variante local ou do payload
- `image_snapshot` com imagem primária do produto

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/checkout-router/index.ts` | Buscar size/color/sku na query de variantes; salvar variant_info, sku_snapshot e image_snapshot nos order_items |
| `supabase/functions/yampi-webhook/index.ts` | No path de UPDATE (linhas 252-276), enriquecer order_items existentes com dados do webhook/banco |

