# Vincular Sincronizacao Bling por SKU e Proteger Nomes Editaveis

## Problema Identificado

Existem **dois problemas** trabalhando juntos:

1. **A cada sincronizacao, o nome do produto e sobrescrito pelo nome do Bling** (linhas 457 e 482 do `bling-sync`, linha 151 do `bling-webhook`). Quando voce edita o nome no site, a proxima sincronizacao reverte para o nome original do Bling. Isso tambem regenera o slug, podendo quebrar links.
2. **O filtro `hasStock()` em `useProducts.ts**` oculta todos os produtos cujas variantes tem estoque 0. Se a sincronizacao de estoque falhar por qualquer motivo, os produtos somem da loja.

## Solucao

### 1. Proteger campos editaveis na sincronizacao (bling-sync)

Na funcao `upsertParentWithVariants`, ao **atualizar** um produto existente, remover os campos `name`, `slug` e `description` do objeto de update. Esses campos so serao definidos na **insercao inicial** (produto novo).

Campos que continuam sincronizando normalmente:  `sku`, `gtin`, `weight`, `is_active`, `category_id`, etc.

### 2. Proteger campos editaveis no webhook (bling-webhook)

Na funcao `syncSingleProduct`, remover `name` e `description` do update de produtos existentes. Mesma logica: precos e estoque sincronizam, nome nao.

### 3. Vincular variantes por bling_variant_id (ja funciona)

A vinculacao de variantes ja usa `bling_variant_id` (linhas 580-584 do bling-sync e linhas 172-176 do bling-webhook), que e o identificador unico do Bling. Isso esta correto. O SKU e salvo como referencia adicional mas o match principal e pelo ID do Bling, que nunca muda.

### 4. Ativar produto automaticamente se houver estoque

Apos sincronizar variantes, verificar se pelo menos uma variante ativa tem `stock_quantity > 0`. Se sim, garantir que o produto pai tenha `is_active = true`. Isso resolve o caso onde o Bling marca `situacao = "A"` mas o estoque vem zerado.

### 5. Remover filtro hasStock do frontend

Remover a funcao `hasStock` e o `.filter()` do `useProducts.ts`. Todos os produtos ativos aparecerao na loja. Produtos sem estoque terao o botao de compra desabilitado na pagina de detalhe (ja validado pelo carrinho/checkout).

## Detalhes Tecnicos

### Arquivo: `supabase/functions/bling-sync/index.ts`

**Funcao `upsertParentWithVariants` (linha ~456-498):**

- Separar `productData` em dois objetos: `insertData` (com name, slug, description) e `updateData` (sem esses campos)
- No bloco `if (existing)` (linha 481-484): usar `updateData` ao inves de `productData`
- No bloco `else` (linha 485-498): usar `insertData` completo (insercao inicial)

**Apos sincronizacao de variantes (linha ~680):**

- Adicionar query para verificar se alguma variante ativa tem stock > 0
- Se sim, fazer `update({ is_active: true })` no produto pai

### Arquivo: `supabase/functions/bling-webhook/index.ts`

**Funcao `syncSingleProduct` (linha ~150-157):**

- Remover `name` do objeto de update
- Remover `description` do objeto de update
- Manter preco, is_active, weight

### Arquivo: `src/hooks/useProducts.ts`

- Remover funcao `hasStock` (linhas 57-62)
- Remover `.filter(p => hasStock(p))` das linhas 46, 52, 104
- Retornar todos os produtos ativos diretamente

### Resultado esperado

- Voce pode editar nomes e descricoes no site sem que a sincronizacao reverta
- Estoque e precos continuam sincronizando automaticamente pelo ID do Bling
- Todos os produtos ativos aparecem na loja, independente do estoque
- Se uma variante tiver estoque no Bling, o produto pai fica ativo automaticamente