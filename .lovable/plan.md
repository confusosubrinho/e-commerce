

# Revisao Completa do Checkout - Plano de Correcoes

## Problemas Encontrados

### 1. CRITICO: Desconto PIX hardcoded em 5% (ignora configuracao do admin)
O checkout usa `total * 0.95` fixo, mas o painel admin tem `pix_discount: 5` configuravel. Se o admin mudar para 3% ou 10%, o checkout vai ignorar.

**Correcao:** Buscar `pix_discount` de `store_settings` no checkout e usar dinamicamente.

### 2. CRITICO: Parcelas fixas em 6x (ignora configuracoes do admin)
- O checkout envia `installments: 6` fixo para a Appmax (linha 227)
- O texto diz "em ate 6x sem juros" mas o admin configurou `max_installments: 10` e `installments_without_interest: 5`
- Nao existe seletor de parcelas para o cliente escolher

**Correcao:** Buscar config de parcelas do `store_settings`, criar seletor de parcelas no step de pagamento com calculo de juros dinamico.

### 3. CRITICO: Frete no checkout ignora o frete calculado no carrinho
O checkout tem fretes "fantasma" hardcoded (padrao R$15, expresso R$25) na etapa de entrega (linhas 528-554), em vez de usar o frete real calculado via Melhor Envio que ja esta no `selectedShipping` do carrinho.

**Correcao:** Remover as opcoes de frete ficticio do checkout e usar o `ShippingCalculator` real integrado ao Melhor Envio. Se o frete ja foi calculado no carrinho, exibi-lo. Senao, permitir calcular.

### 4. IMPORTANTE: Cupom nao e salvo no pedido
O campo `coupon_code` na tabela `orders` nunca e preenchido (linha 148-166 do insert). O desconto e aplicado no valor mas sem rastreabilidade.

**Correcao:** Salvar `coupon_code` no pedido e incrementar `uses_count` do cupom apos confirmar pagamento.

### 5. IMPORTANTE: Cupom nao e validado no servidor
A validacao do cupom acontece apenas no frontend (CouponInput.tsx). Um usuario tecnico pode manipular o desconto no localStorage. A edge function `process-payment` nao revalida o cupom.

**Correcao:** Adicionar validacao do cupom na edge function antes de processar o pagamento.

### 6. IMPORTANTE: Bairro nao e enviado para a Appmax
O campo `neighborhood` e coletado mas nao e enviado no payload da Appmax (falta `address_street_district` no customer). Ja esta presente na edge function, porem o checkout nao envia esse campo no payload.

**Correcao:** Verificar - na verdade o campo `shipping_neighborhood` JA esta no payload (linha 214). OK, este item esta correto.

### 7. IMPORTANTE: Estoque nao e decrementado
Quando um pedido e criado, o estoque do `product_variants` nao e reduzido. Dois clientes podem comprar o mesmo ultimo item.

**Correcao:** Decrementar estoque na edge function apos pagamento confirmado, com verificacao previa de disponibilidade.

### 8. MEDIO: Campo `customer_id` nunca preenchido nos pedidos
O insert do pedido nao vincula ao registro da tabela `customers`. Isso prejudica o historico de compras e relatorios.

**Correcao:** Buscar ou criar registro na tabela `customers` e vincular ao pedido.

### 9. MEDIO: Sem validacao de email no frontend
O campo de email nao valida formato. Um email invalido causa falha na Appmax.

**Correcao:** Adicionar validacao de formato de email antes de avancar.

### 10. MEDIO: Carrinho no Cart.tsx usa `freeShippingThreshold` hardcoded em 399
A pagina do carrinho usa `const freeShippingThreshold = 399` fixo em vez de buscar do `store_settings`.

**Correcao:** Buscar o valor de `free_shipping_threshold` do banco.

### 11. MENOR: Console.logs com dados sensiveis
Linhas 252 e 174 fazem `console.log` com dados de pagamento. Em producao isso expoe informacoes.

**Correcao:** Remover ou reduzir os logs.

### 12. MENOR: CORS headers incompletos na edge function
A edge function `process-payment` nao inclui todos os headers recomendados (faltam `x-supabase-client-platform`, etc).

**Correcao:** Atualizar os CORS headers.

---

## Plano de Implementacao

### Etapa 1: Edge Function - Seguranca e Validacao
- Atualizar CORS headers completos em `process-payment`
- Adicionar validacao de cupom server-side (buscar cupom, verificar validade/usos/valor minimo, recalcular desconto)
- Decrementar estoque dos variants apos pagamento confirmado
- Incrementar `uses_count` do cupom utilizado
- Remover logs sensiveis

### Etapa 2: Checkout - Configuracoes Dinamicas
- Buscar `store_settings` (pix_discount, max_installments, installments_without_interest, installment_interest_rate, min_installment_value, free_shipping_threshold) ao montar o checkout
- Substituir frete ficticio pelo `ShippingCalculator` real na etapa de entrega
- Criar seletor de parcelas dinamico baseado nas configs do admin
- Usar `pix_discount` dinamico no calculo do total
- Adicionar CouponInput no checkout
- Salvar `coupon_code` no pedido
- Adicionar validacao de email

### Etapa 3: Carrinho - Sincronizar Configuracoes
- Buscar `free_shipping_threshold` do banco no Cart.tsx em vez de usar 399 fixo
- Buscar `max_installments` para exibir parcelas corretas no resumo

### Etapa 4: Vinculacao de Cliente
- No handleSubmit, buscar ou criar registro em `customers` pelo email/CPF
- Vincular `customer_id` ao pedido

---

## Detalhes Tecnicos

### Seletor de Parcelas (novo componente no step payment)
- Calcular parcelas de 1x ate `max_installments`
- Parcelas ate `installments_without_interest`: sem juros (valor / n)
- Parcelas acima: com juros de `installment_interest_rate`% ao mes
- Valor minimo por parcela: `min_installment_value`
- Enviar numero de parcelas selecionado para a Appmax

### Validacao de Cupom Server-side (na edge function)
- Receber `coupon_code` no payload
- Buscar cupom no banco, verificar: ativo, nao expirado, usos disponiveis, valor minimo
- Recalcular desconto e comparar com o `discount_amount` enviado
- Rejeitar se houver divergencia

### Controle de Estoque
- Antes de processar pagamento: verificar se todos os itens tem estoque suficiente
- Apos pagamento aprovado: decrementar `stock_quantity` em `product_variants`
- Se estoque insuficiente: retornar erro claro

