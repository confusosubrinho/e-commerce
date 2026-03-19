## Checklist de arquitetura (Storefront)

### Páginas (App Router)

- **RSC por padrão**: `layout.tsx` e `page.tsx` como Server Components.
- **loading/error**:
  - `loading.tsx` para rota
  - `error.tsx` para erros inesperados
  - `not-found.tsx` para 404 (produto/categoria inexistente)
- **Suspense local**: use para “fatias” da UI (ex.: recomendações, facets, shipping estimate).

### Dados e caching

- **Contrato claro**: funções de leitura retornam tipos estáveis (evitar “any”/shape implícito).
- **Cache intencional**:
  - Prefira “cache no server” (RSC) e invalidação explícita (path/tag) quando fizer sentido.
  - Evite refetch no client como padrão.
- **Consistência**:
  - preço/estoque calculados no server
  - filtros/sort validados no server

### Domínios e limites

- `catalog/`: navegação, busca, PLP/PDP, variantes, SEO
- `cart/`: itens, totais, cupons, frete (cálculo)
- `checkout/`: endereço, pagamento, pedido (status)

Regra: se uma lógica impacta “preço/estoque/checkout”, ela **não** deve estar duplicada em múltiplos lugares.

## Estrutura sugerida (adaptável)

> Ajuste para o padrão real do seu projeto, mas mantenha a separação por domínio.

- `src/catalog/`
  - `queries/` (leitura: PLP/PDP, busca, facets)
  - `ui/` (componentes de PLP/PDP)
  - `routes/` (helpers de rota, se necessário)
- `src/cart/`
  - `actions/` (server actions: add/update/remove/applyCoupon)
  - `queries/` (getCart)
  - `domain/` (cálculos e invariantes)
  - `ui/` (drawer/page/summary)
- `src/checkout/`
  - `actions/`
  - `queries/`
  - `domain/` (estado do pedido)
  - `ui/`

## Decisões rápidas (padrão)

### Quando usar `use client`

Use apenas quando precisar de:
- estado local (seleção de variante, abertura/fechamento, input controlado)
- interação direta (menus, drawers, toasts)

Evite `use client` para:
- buscar dados
- cálculo de preços/estoque
- “montar” payloads não validados

### PLP: filtros e ordenação

- URL como fonte da verdade (`page/perPage/sort/q/filters`)
- validação no server (Zod)
- query server-side com total para paginação

### PDP: variantes

- variante selecionada deve ser resolvida de forma determinística:
  - query param (ex.: `?variant=...`) ou estado local + URL (quando útil)
- disponibilidade e preço sempre validados no server no “add to cart”

## Referências (para estudo)

- [`vercel/commerce`](https://github.com/vercel/commerce) (App Router, composição e padrões de e-commerce)
- [`yournextstore/yournextstore`](https://github.com/yournextstore/yournextstore) (template “AI-native” com patterns previsíveis)
