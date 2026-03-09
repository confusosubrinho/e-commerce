

# Auditoria UX Completa — Rodada 6

## Problemas de UX Identificados

### UX 1 — ALTO: FavoritesPage carrega TODOS os produtos para filtrar favoritos
Em `FavoritesPage.tsx` linha 12, `useProducts()` busca todos os produtos do banco para depois filtrar localmente por IDs favoritados (linha 13). Isso é ineficiente e lento em catálogos grandes. Além disso, não há Helmet/meta tags na página.

**Correção:** Criar uma query dedicada que busca apenas os produtos cujos IDs estão na lista de favoritos (`.in('id', favorites)`). Adicionar `<Helmet>` com título "Meus Favoritos".

### UX 2 — ALTO: SearchPage não exibe preço PIX nem parcelas nos resultados
A `ProductGrid` utilizada na busca renderiza `ProductCard` que já mostra essas informações, porém a página de busca não oferece filtros (preço, tamanho, cor) como a `CategoryPage` oferece. Usuários que buscam não conseguem refinar resultados.

**Correção:** Adicionar o componente `CategoryFilters` na `SearchPage`, reutilizando a mesma lógica de `CategoryPage` para filtrar por preço, tamanho, cor e ordenação.

### UX 3 — MÉDIO: VariantSelectorModal não mostra preço PIX nem parcelas
O modal de seleção rápida de variante (aberto pelo botão de compra no ProductCard) mostra apenas o preço base/promoção (linha 57-58), sem desconto PIX nem informação de parcelamento. Isso é inconsistente com o ProductCard e ProductDetail.

**Correção:** Importar `usePricingConfig` e exibir preço PIX e parcelas no modal, mantendo paridade com o restante da loja.

### UX 4 — MÉDIO: Cart.tsx imagem do produto não usa `resolveImageUrl`
Linha 118: `src={item.product.images?.[0]?.url || '/placeholder.svg'}` — não passa pela função `resolveImageUrl` que otimiza e resolve URLs. No carrinho lateral (Header.tsx linha 369), a imagem usa `resolveImageUrl` corretamente. Inconsistência entre os dois carrinhos.

**Correção:** Alterar para `src={resolveImageUrl(item.product.images?.[0]?.url)}` no Cart.tsx.

### UX 5 — MÉDIO: Newsletter promete "cupom de 5%" sem validação real
O componente Newsletter (linhas 56-60) tem texto hardcoded "Ganhe 5% de desconto" e o toast de sucesso diz "cupom de 5% de desconto". Se o cupom não existir no sistema, o usuário se frustra. Este problema foi identificado na rodada anterior mas não foi corrigido.

**Correção:** Tornar o texto configurável buscando de `store_settings` (campos `newsletter_headline` e `newsletter_subtitle`). Fallback para texto genérico sem prometer desconto específico: "Receba novidades e ofertas exclusivas".

### UX 6 — BAIXO: CategoryPage usa `useMemo` com side-effect (setState)
Linha 61-64: `useMemo(() => { setFilters(...) }, [maxPrice])` — usar `useMemo` para executar `setState` é um anti-pattern React. O `useMemo` não deve ter side-effects.

**Correção:** Substituir por `useEffect` para atualizar `priceRange` quando `maxPrice` mudar.

### UX 7 — BAIXO: SearchPreview dropdown não tem indicação de keyboard navigation
O preview de busca (SearchPreview.tsx) mostra resultados ao digitar, mas não suporta navegação por teclado (setas para cima/baixo + Enter). Usuários de desktop perdem eficiência.

**Correção:** Adicionar suporte a `onKeyDown` com navegação por setas e seleção por Enter nos resultados do preview.

## Melhorias Propostas para Implementação

### MELHORIA 1 — Otimizar FavoritesPage com query direta
Substituir `useProducts()` por query filtrada por IDs. Adicionar Helmet.

### MELHORIA 2 — Filtros na SearchPage
Reutilizar `CategoryFilters` na página de busca.

### MELHORIA 3 — Preço PIX e parcelas no VariantSelectorModal
Adicionar informações de preço PIX e parcelamento no modal de variantes.

### MELHORIA 4 — Usar resolveImageUrl no Cart.tsx
Corrigir imagem do carrinho para usar `resolveImageUrl`.

### MELHORIA 5 — Newsletter com texto configurável
Buscar textos da newsletter de `store_settings`, fallback genérico.

### MELHORIA 6 — Corrigir useMemo com side-effect no CategoryPage
Substituir `useMemo` por `useEffect` para atualizar filtro de preço.

## Arquivos Modificados

- **`src/pages/FavoritesPage.tsx`** — Query otimizada + Helmet
- **`src/pages/SearchPage.tsx`** — Adicionar filtros de busca
- **`src/components/store/VariantSelectorModal.tsx`** — Preço PIX + parcelas
- **`src/pages/Cart.tsx`** — resolveImageUrl na imagem do produto
- **`src/components/store/Newsletter.tsx`** — Texto configurável via store_settings
- **`src/pages/CategoryPage.tsx`** — Corrigir useMemo → useEffect

## Sem alteração de regras de negócio
Todas as correções são visuais/UX ou otimizações de performance. Nenhuma lógica de pagamento, autenticação ou processamento de dados será alterada.

