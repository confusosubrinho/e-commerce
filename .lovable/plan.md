

## Auditoria do Fluxo de Compra — Bugs e Melhorias UX

Após análise completa de ProductDetail → Cart → CheckoutStart → Checkout → OrderConfirmation/CheckoutReturn, identifiquei os seguintes problemas (sem interferir nas integrações Stripe/Yampi):

---

### Bug 1 (Alto): Preço PIX no ProductDetail não mostra o valor com desconto

Na página de produto (linhas 745-751), o preço principal exibido é `currentPrice` e abaixo aparece apenas o texto "no Pix (5% off)" — mas **não mostra o valor final com desconto PIX**. O visitante precisa calcular mentalmente. No ProductCard (grid), o `pixPrice` é calculado e exibido corretamente. Inconsistência entre grid e página de detalhe.

**Fix**: Exibir o valor com desconto PIX (`currentPrice - pixDiscountAmount`) abaixo do preço principal, similar ao que o ProductCard já faz.

---

### Bug 2 (Alto): Checkout não valida shipping antes de prosseguir quando CEP do carrinho não está carregado

No `Checkout.tsx`, o CEP é pré-preenchido do cart context (linha 822-824), mas o `ShippingCalculator` dentro do checkout (linha 1116) não auto-calcula — o usuário precisa clicar "Calcular" manualmente novamente. Se o frete já foi selecionado no carrinho, a validação passa (`selectedShipping` ainda está no context), mas se o usuário muda o endereço/CEP no checkout, o frete antigo continua selecionado com preço possivelmente errado.

**Fix**: Limpar `selectedShipping` quando o CEP no formulário de checkout diverge do `shippingZip` do context. Adicionar auto-cálculo quando o CEP do formulário é preenchido via busca de CEP.

---

### Bug 3 (Médio): Botão "Finalizar Compra" no carrinho permite navegar sem shipping selecionado

Na página Cart (linhas 249-259), o botão usa `asChild` com `Link` e `Pressable` simultaneamente. Quando `selectedShipping` é null, ele mostra "Calcule o frete primeiro" e `disabled={!selectedShipping}` — mas o `Link` com `asChild` pode ainda permitir navegação em certas condições (tab + enter, ou assistive tech). Além disso, o `onClick` no `Pressable` verifica `selectedShipping` mas o `Link` subjacente pode navegar antes.

**Fix**: Renderizar `Button` sem `Link` quando `!selectedShipping`, e só renderizar como `Link` quando habilitado.

---

### Bug 4 (Médio): Quantidade no seletor mobile da página de produto está oculta

O seletor de quantidade tem `className="hidden md:block"` (linha 846), ou seja, no mobile o visitante **não pode alterar a quantidade** antes de adicionar ao carrinho. Sempre adiciona 1 unidade. Isso é intencional para simplificar, mas causa frustração quando o cliente quer 2+ pares.

**Fix**: Mostrar seletor de quantidade compacto inline no mobile, ao lado do botão de adicionar.

---

### Bug 5 (Médio): PIX tab no ProductDetail mostra preço sem desconto

Na aba "Pagamento" do ProductDetail (linhas 491-497), o preço exibido para PIX é `currentPrice` (preço cheio). Deveria mostrar `currentPrice - pixDiscountAmount` para ser consistente.

**Fix**: Exibir preço com desconto PIX e mostrar o preço original riscado.

---

### Bug 6 (Baixo): `clearCart` no `CheckoutReturn` é chamado incondicionalmente

No `CheckoutReturn.tsx` (linha 29), `clearCart()` é chamado no mount, mesmo se o pagamento falhou ou o pedido não foi encontrado. Se o visitante cancelou no gateway e voltou, perde o carrinho.

**Fix**: Só limpar o carrinho quando o pedido é encontrado e o status não é `cancelled`/`failed`.

---

### Bug 7 (Baixo): ShippingCalculator `id` prop não existe no `ShippingOption`

O `ShippingOption` no `database.ts` requer `id: string`, mas a API de shipping retorna options sem `id`. O fallback hardcoded (linhas 66-68, 93-95) também não inclui `id`. Isso faz o TypeScript reclamar silenciosamente e pode causar bugs de seleção.

**Fix**: Gerar `id` automático nas options retornadas (hash do nome + preço) ou tornar `id` opcional no tipo.

---

### Melhoria 1: Feedback visual de loading no botão "Calcular" do ShippingCalculator

Quando o cálculo de frete demora, o botão mostra o spinner mas não desabilita interações adjacentes. Adicionar skeleton nas opções de frete enquanto carrega.

---

### Arquivos a Modificar

1. **`src/pages/ProductDetail.tsx`** — Exibir preço PIX com desconto no header e na aba Pagamento; mostrar seletor de quantidade no mobile
2. **`src/pages/Checkout.tsx`** — Limpar shipping quando CEP diverge; auto-recalcular frete
3. **`src/pages/Cart.tsx`** — Separar renderização do botão com/sem Link
4. **`src/pages/CheckoutReturn.tsx`** — Condicionar clearCart ao status do pedido
5. **`src/types/database.ts`** — Tornar `ShippingOption.id` opcional ou usar geração automática

