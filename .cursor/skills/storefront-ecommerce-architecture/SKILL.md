---
name: storefront-ecommerce-architecture
description: Define padrões de arquitetura de Storefront (e-commerce) em Next.js App Router (RSC, Suspense, Server Actions) para Catálogo (PLP/PDP), carrinho e checkout, com foco em composição e estados (loading/error/empty/success). Use quando o usuário mencionar storefront, arquitetura de e-commerce, catálogo, PLP, PDP, produto, coleção/categoria, carrinho, checkout, App Router, Server Components, Suspense, streaming, server actions ou “padrão vercel/commerce”.
---

# Storefront / Arquitetura de E-commerce (Next.js)

## Objetivo

Guiar a implementação de um storefront com **App Router** priorizando:
- **Server Components como padrão**
- **Suspense/streaming** para UX rápida
- **Server Actions** para mutações (com validação)
- **Composição** (PLP/PDP/carrinho) como unidades reutilizáveis

Referências de arquitetura:
- [vercel/commerce](https://github.com/vercel/commerce)
- [yournextstore/yournextstore](https://github.com/yournextstore/yournextstore)

## Princípios (obrigatórios)

- **RSC-first**: pages e layouts são Server Components por padrão; `use client` só quando necessário.
- **Estados obrigatórios**: `loading`, `error`, `empty`, `success` em PLP/PDP/carrinho/checkout.
- **Suspense com fallback**: todo trecho “caro” deve ser “embrulhado” em `Suspense`.
- **Dados no servidor**: buscar no server (RSC / Route Handlers / server actions); client só controla interação.
- **Mutação segura**: usar **Server Actions** com validação (ex.: Zod) e retorno estruturado.
- **Fonte de verdade**:
  - Carrinho/pedido: o **servidor** valida e calcula (frete/preço/estoque).
  - Checkout/pagamento: confirmação por webhook (quando aplicável).

## Organização recomendada (alto nível)

Modele “Storefront” como domínios:
- `catalog/` (produtos, categorias/coleções, busca, PLP, PDP)
- `cart/` (estado, cálculos, itens, cupons, frete)
- `checkout/` (endereço, pagamento, pedido)

Evite “pasta genérica” para regra de negócio (ex.: `src/services`).

## Workflow (padrão prático)

### 1) PLP (Product Listing Page)

- Parseie query params no **servidor** (`page`, `perPage`, `sort`, `q`, filtros).
- Busque dados no server e renderize:
  - **Toolbar** (filtros + ordenação)
  - **Grid** (lista de cards)
  - **Paginação** (server-side)
- Use `Suspense` para:
  - grid
  - facets/filtros (se caros)

### 2) PDP (Product Detail Page)

- Renderize com composição:
  - `ProductGallery`
  - `ProductInfo`
  - `VariantSelector` (client só se necessário)
  - `AddToCartButton` (client só para interação; mutação via server action)
- Garanta:
  - **canonical** e metadados SEO
  - estados de erro/404 coerentes
  - variantes/estoque/preço resolvidos no server

### 3) Carrinho

- Leitura no server (cookie/session/DB).
- Mutações via Server Actions: add/remove/update/clear/apply-coupon.
- Após mutação: revalidar/atualizar UI (revalidatePath/tag ou refresh, conforme arquitetura).

### 4) Checkout

- Separar etapas (dados do cliente / entrega / pagamento).
- Nunca “marcar como pago” no client; páginas de sucesso são UX.

## Anti-patterns (evitar)

- Duplicar cálculo de preço/estoque no client.
- `useEffect` para “buscar dados” que deveriam vir do server.
- Tratar `loading/error` só com skeleton global; prefira `Suspense` local.
- Misturar PLP/PDP com regras de carrinho/checkout (limites de domínio).

## Recursos

- Exemplos práticos (PLP/PDP/carrinho): [examples.md](examples.md)
- Checklist e referência (caching, composição, estrutura): [reference.md](reference.md)
