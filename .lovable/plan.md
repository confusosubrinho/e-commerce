

# Auditoria de Bugs e Melhorias — Rodada 4

## Bugs Encontrados

### BUG 1 — MÉDIO: Memory leak no `recentErrors` Map do `errorLogger.ts`
O `recentErrors` Map em `src/lib/errorLogger.ts` (linha 20) nunca é limpo. Cada erro único adiciona uma entrada que permanece em memória indefinidamente. Em sessões longas com erros variados (ex: URLs diferentes no message), o Map cresce sem limite.

**Correção:** Adicionar limpeza periódica — após cada `.set()`, remover entradas com timestamp mais antigo que `RATE_LIMIT_MS`. Ou limitar o tamanho do Map a 100 entradas e remover as mais antigas quando exceder.

### BUG 2 — MÉDIO: `AdminAuthContext` sobrescreve `window.fetch` e pode conflitar com outros interceptors
Em `src/contexts/AdminAuthContext.tsx` linhas 33-62, o useEffect substitui `window.fetch` por um wrapper que intercepta 401/403. Se o componente desmontar e remontar (ex: navegação rápida), a referência de `originalFetch` pode ficar encadeada incorretamente. Além disso, se `onSessionExpired` mudar de referência entre renders, o efeito recria o wrapper, causando uma cadeia de closures desnecessária.

**Correção:** Usar `useRef` para `onSessionExpired` em vez de incluí-lo no dependency array do `useEffect`, evitando recriações do wrapper de fetch. Isso estabiliza o patching e evita acumulação de closures.

### BUG 3 — BAIXO: `guestToken` pode ser regenerado em pedidos pendentes reutilizados no Checkout
Em `Checkout.tsx` linha 426, quando um pedido pendente é reutilizado com Stripe, um novo `guestToken` é gerado (`crypto.randomUUID()`). Porém, o pedido original pode já ter um `access_token` diferente no banco. O novo token é enviado ao Stripe mas nunca é salvo no pedido existente, fazendo com que o guest não consiga acessar a confirmação do pedido com o token original.

**Correção:** Ao reutilizar pedido existente, ler o `access_token` já salvo no banco em vez de gerar um novo. Se não houver, aí sim gerar e atualizar o pedido.

### BUG 4 — BAIXO: `useSearchProducts` vulnerável a SQL injection via pattern matching
Em `useProducts.ts` linha 57, `searchTerm` é sanitizado para `%`, `_`, `\` mas não para outros caracteres especiais do PostgREST filter syntax (ex: `)` ou `.`). O `.or()` na linha 71 interpola o valor diretamente na string do filtro. Se um usuário digitar `%,name.eq.admin)--`, pode manipular o filtro.

**Correção:** Usar `.ilike()` com parâmetro separado em vez de interpolação dentro de `.or()`. Alternativamente, usar `.filter()` com parâmetros parametrizados ou aplicar sanitização mais rigorosa.

### BUG 5 — BAIXO: `ShippingCalculator` não invalida opções de frete ao mudar items do carrinho
Quando o usuário está na tela de produto ou carrinho com frete já calculado, adicionar/remover itens não recalcula o frete. O peso/volume dos produtos mudou mas as opções exibidas são as antigas. O `freeShippingEligible` atualiza corretamente (depende de `subtotal`), mas os preços base das opções de frete permanecem os do cálculo anterior.

**Correção:** Adicionar `items.length` ao useEffect de auto-cálculo (linha 23-27) para recalcular quando itens mudam, ou limpar `shippingOptions` quando `items` mudar significativamente.

## Melhorias Propostas

### MELHORIA 1 — Evitar memory leak no error rate limiter
Adicionar cleanup ao Map: após cada `set`, filtrar entradas expiradas. Limitar a 200 entradas máximas.

### MELHORIA 2 — Estabilizar fetch interceptor no AdminAuthContext
Usar `useRef` para callback `onSessionExpired` para evitar recriações do wrapper de fetch.

### MELHORIA 3 — Reutilizar `access_token` existente em pedidos pendentes
No fluxo de reutilização de pedido (Checkout.tsx ~linha 423), buscar o `access_token` do pedido existente antes de gerar um novo.

### MELHORIA 4 — Sanitizar busca de produtos contra filter injection
Substituir `.or()` com interpolação por `.ilike()` separados encadeados.

### MELHORIA 5 — Documentar comportamento intencional do ShippingCalculator
Adicionar comentário explicativo sobre o recálculo ser apenas por CEP (UX consciente).

## Arquivos Modificados

- **`src/lib/errorLogger.ts`** — Limpeza periódica do Map `recentErrors`
- **`src/contexts/AdminAuthContext.tsx`** — Usar `useRef` para `onSessionExpired`
- **`src/pages/Checkout.tsx`** — Reutilizar `access_token` existente em pedidos pendentes
- **`src/hooks/useProducts.ts`** — Sanitizar busca contra filter injection
- **`src/components/store/ShippingCalculator.tsx`** — Apenas comentário documental

## Sem alteração de regras de negócio
Todas as correções são defensivas. Nenhum fluxo de pagamento, autenticação ou lógica de negócio existente será alterado.

