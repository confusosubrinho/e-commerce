## Exemplos (Storefront / E-commerce)

### Exemplo 1 — PLP com query params no server

**Cenário**: “Listar produtos com paginação, ordenação e busca, mantendo URL como fonte da verdade.”

- **Entrada**: `/categoria/camisetas?page=2&perPage=24&sort=price.asc&q=algodao`
- **Saída esperada**:
  - Parse/validação no server (Zod).
  - Busca no server retornando `{ rows, total }`.
  - UI com estados: loading/error/empty/success.

### Exemplo 2 — PDP com composição e `Suspense` local

**Cenário**: “PDP renderizada em RSC, mas seletor de variante e botão de carrinho interativos.”

- **Padrão**:
  - `page.tsx` como Server Component
  - `VariantSelector` como client component somente se precisar de estado local
  - `addToCartAction` como server action (valida input; recalcula carrinho no server)
  - `Suspense` envolvendo “recomendações” / “produtos relacionados” / “reviews”

### Exemplo 3 — Carrinho com mutações via Server Actions

**Cenário**: “Atualizar quantidade sem duplicar lógica de cálculo no client.”

- **Padrão**:
  - `CartSummary` renderiza subtotal/total vindos do server
  - Botões `+/-` chamam actions:
    - `cartItemIncrementAction`
    - `cartItemDecrementAction`
  - Após sucesso, revalidar (path/tag) ou `router.refresh()` conforme padrão do projeto

### Exemplo 4 — Checkout: “success” não confirma pagamento

**Cenário**: “Página `/checkout/success` apenas confirma que o usuário concluiu o fluxo, mas o pedido só vira ‘paid’ via webhook.”

- **Padrão**:
  - `success` mostra status “processando / confirmado” (pode fazer polling server-side/streaming)
  - Tabela `orders` guarda estado
  - Webhook atualiza `orders.status`
