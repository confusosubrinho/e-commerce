

## Auditoria Yampi — Bugs e Melhorias

Após análise completa das Edge Functions `yampi-webhook`, `checkout-router` (path Yampi), `yampi-import-order`, `yampi-sync-order-status`, `yampi-catalog-sync`, `checkout-create-session` e do frontend `CheckoutStart`, identifiquei os seguintes problemas:

---

### Bug 1 (Alto): Precedência do ternário no `customerName` — nome do cliente perdido

No `yampi-webhook`, linhas 112-114 e 206-208, a lógica de extração do nome é:

```javascript
const customerName = customer?.name || customer?.first_name
  ? `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim()
  : resourceData?.customer_name || "Cliente Yampi";
```

JavaScript avalia como `(customer?.name || customer?.first_name) ? template : fallback`. Se `customer.name` é "Maria Silva" mas `first_name` é `undefined`, a condição é `true` (porque `name` é truthy), mas o template gera `"" + " " + ""`.trim() = `""`. Resultado: nome vazio gravado no pedido.

**Fix**: Usar parênteses para priorizar `customer.name` como primeiro valor, com fallback para `first_name + last_name`:

```javascript
const customerName = customer?.name
  || (customer?.first_name ? `${customer.first_name} ${customer?.last_name || ""}`.trim() : null)
  || resourceData?.customer_name
  || "Cliente Yampi";
```

Corrigir nas **duas ocorrências** no webhook (linhas 112 e 206).

---

### Bug 2 (Alto): `decrement_stock` não verifica resultado no webhook — estoque pode ficar negativo

No `yampi-webhook`, linhas 152 e 364, `decrement_stock` é chamado mas o resultado (`success: false, error: 'insufficient_stock'`) é **ignorado**. A RPC tem um trigger `validate_stock_nonneg` que lança exceção quando `stock_quantity < 0`, mas o webhook não trata essa exceção. Isso pode fazer o webhook retornar erro 200 (try/catch global) sem informar que o estoque é insuficiente, e o pedido fica "processing" com estoque inconsistente.

**Fix**: Verificar o retorno de `decrement_stock`. Se `success === false`, logar warning mas continuar o processamento (não bloquear o pedido — é melhor ter estoque negativo temporário do que perder a venda). Insertar o inventory_movement somente se `success === true`.

---

### Bug 3 (Médio): checkout-router não reserva estoque para Yampi external — risco de overselling

Quando `channel === "external" && provider === "yampi"`, o `checkout-router` cria o pedido e os `order_items` (linhas 291-313) mas **não chama `decrement_stock`**. O estoque só é decrementado quando o webhook de pagamento aprovado chega. Entre a criação do pedido e o pagamento, outro cliente pode comprar o mesmo item, causando overselling.

**Fix**: Adicionar reserva de estoque (tipo "reserve" no inventory_movements) no checkout-router para o path Yampi external, similar ao que já é feito para Stripe. O webhook então converte "reserve" para "debit" ao confirmar pagamento. Se o pagamento não chegar em 2h, o `checkout-release-expired-reservations` libera o estoque.

---

### Bug 4 (Médio): `checkout-create-session` não usa `getCorsHeaders` compartilhado

O `checkout-create-session` (linha 357-361) tem um `jsonRes` local que sempre retorna `getCorsHeaders(null)` — que resolve para o primeiro origin do array (`vanessalima.lovable.app`). Quando chamado diretamente do browser (não via checkout-router), requisições de outros domínios (ex: `vanessalimashoes.com.br`) podem ter CORS bloqueado.

**Fix**: Passar o `Origin` do request para `getCorsHeaders(origin)` no `jsonRes` e no OPTIONS handler, similar ao checkout-router.

---

### Bug 5 (Baixo): `yampi-webhook` usa CORS hardcoded `*` em vez do compartilhado

O webhook usa `Access-Control-Allow-Origin: *` hardcoded. Embora webhooks sejam server-to-server (Yampi → Edge Function), usar `*` é desnecessário e inconsistente com as outras funções. Não é um bug funcional, mas viola a política de segurança documentada.

**Fix**: Importar e usar `getCorsHeaders` do shared. Para webhooks, podemos manter `*` já que não vêm do browser, mas o `Access-Control-Allow-Headers` deve incluir os headers do Supabase client para consistência.

---

### Bug 6 (Baixo): Yampi customer data extraction ignora `customer.data` wrapper

A API Yampi às vezes retorna `customer: { data: { email, first_name, ... } }` com um wrapper `data`. O `yampi-import-order` já trata isso (linha 165: `customer.data || customer`), mas o `yampi-webhook` (linhas 110, 204) acessa `customer?.email` diretamente sem unwrap do `.data`. Se a Yampi retornar o formato com wrapper, o email e nome ficam nulos.

**Fix**: Adicionar unwrap `const customerData = customer?.data || customer;` no webhook, similar ao import-order.

---

### Arquivos a Modificar

1. **`supabase/functions/yampi-webhook/index.ts`** — Corrigir ternário do customerName (2x), unwrap customer.data, verificar retorno de decrement_stock
2. **`supabase/functions/checkout-router/index.ts`** — Adicionar reserva de estoque no path Yampi external
3. **`supabase/functions/checkout-create-session/index.ts`** — Usar getCorsHeaders com origin do request

