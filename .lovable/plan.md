

# Fix: Enriquecer order_items com nome, SKU e vinculação a produto local

## Problema

Os logs confirmam que ao sincronizar, o item Yampi tem:
- `item.sku.data.title` = "Conjunto colar aramado e brinco gota Único Dourado" (nome real)
- `item.sku.data.sku` = "VLS-CONCOLARA-704-ÚNICO-DOU"  
- `item.sku_id` = 293742659
- `item.product` **não existe** no payload

Mas o código atual:
1. Busca nome em `productData.name` (que é `{}` porque `item.product` não existe) → `null`
2. Nunca consulta `product_variants` para vincular `product_id` e `product_variant_id` ao pedido
3. Extrai "Tamanho / Cor" como variação (nomes dos eixos) em vez dos **valores** ("Único / Dourado")

## Correções em `yampi-sync-order-status/index.ts`

### 1. Extrair nome do produto de `skuData.title`
```typescript
const productName = (item.name as string) || (skuData.title as string) || 
  (productData.name as string) || (item.product_name as string) || null;
```

### 2. Vincular a produto local (como `yampi-import-order` já faz)
Após extrair `yampiSkuId`, consultar `product_variants` por `yampi_sku_id` e por `sku` como fallback:
```typescript
let localVariant = null;
if (yampiSkuId) {
  localVariant = await supabase.from("product_variants")
    .select("id, product_id, size, color, sku")
    .eq("yampi_sku_id", yampiSkuId).maybeSingle();
}
if (!localVariant && skuSnapshot) {
  localVariant = await supabase.from("product_variants")
    .select("id, product_id, size, color, sku")
    .eq("sku", skuSnapshot).maybeSingle();
}
// Se encontrou, buscar nome real do produto local
if (localVariant?.product_id) {
  const product = await supabase.from("products").select("name").eq("id", localVariant.product_id).maybeSingle();
  // Preencher product_id, product_variant_id, product_name, image_snapshot
}
```

### 3. Corrigir extração de variações — usar `value_name` em vez de `name`
O payload mostra `variations: [{name: "Tamanho", value_name: "Único"}, ...]`. O código já usa `v.value_name` mas o parsing do array `variations` falha porque está dentro de `sku.data.variations` (array direto, não `{data: [...]}`):
```typescript
const variationsArr = Array.isArray(skuData.variations) 
  ? skuData.variations 
  : (skuData.variations?.data || []);
```

### 4. Buscar imagem do produto local quando Yampi não traz
Se `localVariant.product_id` existe e não há `imageUrl`, buscar de `product_images`.

## Arquivo modificado
- `supabase/functions/yampi-sync-order-status/index.ts` (bloco de enriquecimento de items, linhas ~369-465)

