

# Auditoria do Fluxo Yampi — Bugs, Erros e Melhorias

---

## Problemas Encontrados

### ALTO

**Y1. yampi-webhook: Estoque debitado mesmo quando `decrement_stock` falha (linha 385-398)**
- No bloco de criacao de pedido novo via webhook (sem session_id match), o estoque e debitado e um `inventory_movement` tipo "debit" e inserido MESMO quando `decrement_stock` retorna `{ success: false, error: 'insufficient_stock' }`. O warn e logado mas a execucao continua e o movement e inserido, causando inconsistencia entre o estoque real e os registros de inventario.
- **Impacto**: Estoque pode ficar negativo via webhook enquanto o trigger `validate_stock_nonneg` deveria bloquear. Se o trigger bloqueia, o insert de movement tambem falha silenciosamente.
- **Fix**: So inserir `inventory_movement` se `stockData?.success === true`. Caso contrario, logar o erro mas nao inserir o movement.

**Y2. yampi-import-order: `importSingleOrder` nao faz check de `decrement_stock` result (linha 539-541)**
- A funcao batch `importSingleOrder` chama `decrement_stock` mas ignora completamente o resultado. Se o estoque e insuficiente, debita assim mesmo e insere o `inventory_movement`.
- **Impacto**: Mesmo que Y1 — inconsistencia de estoque em importacoes batch.
- **Fix**: Verificar o resultado do RPC antes de inserir o movement, identico ao fix de Y1.

**Y3. yampi-webhook: Duplicacao massiva de logica customer/order entre os dois caminhos (session match vs novo pedido)**
- As linhas 102-219 (update por session) e 222-471 (create novo) duplicam ~90% da logica: parsing de customer, shipping, pagamento, insert items, upsert customer, email log, Bling push. Qualquer bug fix aplicado a um caminho pode ser esquecido no outro.
- **Impacto**: Risco alto de divergencia entre os dois caminhos. Por exemplo, o caminho "update por session" NAO verifica se `shippingCost` e `discountAmount` sao validos antes de calcular `subtotalOrder`, enquanto o caminho "novo" faz. 
- **Fix**: Extrair uma funcao `processApprovedOrder()` que receba o pedido (existente ou novo) e unifique toda a logica pos-match.

**Y4. yampi-import-order: CORS headers incompletos (linha 8-9)**
- `corsHeaders` usa apenas `"authorization, x-client-info, apikey, content-type"` — faltam os headers `x-supabase-client-platform*` e `x-supabase-client-runtime*`. Pode causar falhas CORS em browsers especificos que enviam esses headers.
- **Impacto**: Requisicoes de import podem falhar com CORS error no admin panel.
- **Fix**: Usar o mesmo conjunto de headers CORS padrao usado nas outras functions.

**Y5. yampi-sync-order-status: Mesma inconsistencia de CORS headers (linha 10-11)**
- Identico a Y4.
- **Fix**: Padronizar CORS headers.

### MEDIO

**Y6. yampi-sync-sku: Nao tem rate-limit entre chamadas PUT (linhas 99-119)**
- O loop de sync de todas as variantes de um produto chama a API Yampi em sequencia sem nenhum `delay()`. Com muitas variantes, isso pode exceder o rate limit da API (2.1s entre chamadas).
- **Impacto**: Erros 429 da API Yampi em produtos com muitas variantes.
- **Fix**: Adicionar `await delay(350)` entre cada chamada PUT, identico ao padrao do `yampi-catalog-sync`.

**Y7. yampi-sync-sku: `price_cost` e `price_sale` recebem o MESMO valor (linha 66-67 e 103-104)**
- `price_cost: unitPrice, price_sale: unitPrice` — o preco de custo e o preco de venda sao identicos. `price_cost` deveria ser o custo real (`base_price` da variante) e `price_sale` deveria ser o preco de venda (`sale_price`).
- **Impacto**: Na Yampi o custo do produto aparece igual ao preco de venda, impossibilitando calculo de margem no painel Yampi.
- **Fix**: Separar: `price_cost = variant.base_price || product.base_price`, `price_sale = variant.sale_price || variant.base_price || product.sale_price || product.base_price`.

**Y8. yampi-webhook: `getCorsHeaders` importado mas nao usado (linha 2)**
- Import `getCorsHeaders` da `_shared/cors.ts` esta no topo mas o webhook usa `corsHeaders` hardcoded. Dead import.
- **Fix**: Remover o import nao usado.

**Y9. yampi-catalog-sync: Produto simples sem stock sync no create (linhas 270-283)**
- Quando um produto simples e criado na Yampi, o payload do SKU inline nao inclui `quantity` (estoque). O campo `availability: 0` e setado, mas o estoque real nao e enviado.
- **Impacto**: Produtos simples aparecem sem estoque na Yampi apos sync. O admin precisa rodar sync de estoque separadamente.
- **Fix**: Adicionar `quantity: activeVariants[0].stock_quantity` ao payload do SKU inline.

**Y10. yampi-sync-images: Dependencia de RPC `get_distinct_synced_products` que pode nao existir (linha 219)**
- A funcao tenta chamar `supabase.rpc("get_distinct_synced_products")` e faz fallback se falhar. Isso gera um erro logado desnecessariamente toda vez que a RPC nao existe.
- **Impacto**: Logs poluidos com erros esperados. Performance impactada pelo erro + fallback query.
- **Fix**: Verificar se a RPC existe primeiro, ou remover a tentativa e usar direto a query de fallback que funciona.

### BAIXO

**Y11. yampi-webhook: Campo `appmax_order_id` setado para webhooks Yampi (linha 85)**
- No insert de `order_events`, o campo `appmax_order_id` recebe o `yampiOrderId`. O nome do campo e confuso pois trata-se de um pedido Yampi, nao Appmax. Funciona porque o campo e apenas uma string de referencia, mas polui semanticamente.
- **Impacto**: Confusao na leitura dos dados. Sem impacto funcional.
- **Fix**: Considerar renomear o campo para `external_order_id` ou criar um campo separado `yampi_order_id` na tabela `order_events`.

**Y12. yampi-catalog-sync e yampi-sync-variation-values: `yampiRequest` duplicada em 4 arquivos**
- A funcao `yampiRequest` e definida quase identicamente em `yampi-catalog-sync`, `yampi-sync-categories`, `yampi-sync-images`, e `yampi-sync-variation-values`.
- **Impacto**: Manutencao dificil, risco de divergencia.
- **Fix**: Extrair para `_shared/yampiRequest.ts` e importar em todas as funcoes.

**Y13. yampi-import-order: Batch function `importSingleOrder` nao normaliza `customer.name` corretamente (linha 471)**
- Usa `${customerData.first_name || ""} ${customerData.last_name || ""}` enquanto a funcao principal (linha 169) prioriza `customer.name`. A batch pode gerar nomes incompletos se a Yampi enviar o campo `name`.
- **Fix**: Unificar logica de nome com a funcao principal.

---

## Plano de Implementacao

### Fase 1 — Bugs de Integridade de Dados (Risco: BAIXO)
1. **Y1**: yampi-webhook — so inserir `inventory_movement` se `decrement_stock` retornou success
2. **Y2**: yampi-import-order `importSingleOrder` — mesmo fix
3. **Y4 + Y5**: Padronizar CORS headers em `yampi-import-order` e `yampi-sync-order-status`

### Fase 2 — Correcoes de Sync (Risco: BAIXO)
4. **Y6**: Adicionar delay entre chamadas PUT em `yampi-sync-sku`
5. **Y7**: Separar `price_cost` e `price_sale` em `yampi-sync-sku`
6. **Y9**: Adicionar `quantity` ao SKU inline em `yampi-catalog-sync`
7. **Y13**: Unificar logica de nome do cliente na batch function

### Fase 3 — Limpeza de Codigo (Risco: ZERO)
8. **Y8**: Remover import nao usado no webhook
9. **Y10**: Remover tentativa de RPC inexistente em `yampi-sync-images`
10. **Y12**: Extrair `yampiRequest` para `_shared/yampiRequest.ts` (escopo maior, pode ser feito depois)

### Nao Implementar Agora
- **Y3**: Refatoracao do webhook e de alto risco — funciona hoje, unificar requer testes extensivos. Documentar para futuro.
- **Y11**: Renomear campo `appmax_order_id` requer migration e pode afetar queries existentes.

