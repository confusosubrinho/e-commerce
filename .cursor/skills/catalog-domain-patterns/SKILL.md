---
name: catalog-domain-patterns
description: Define padrões de engenharia para o domínio de Catálogo (products, categories, variants) além de CRUD. Use quando o usuário mencionar catálogo, produtos, categorias, variantes/variações, SKU, estoque, preço, imagens, SEO, status, destaque, admin/backoffice, listagem, filtros ou paginação.
---

# Padrões para domínio de Catálogo

## Objetivo

Ensinar o agente a pensar **Catálogo como domínio**, com regras e invariantes (variação, estoque, preço, SEO, status), e não como um conjunto de CRUDs desconectados.

## Organização por domínio (obrigatório)

- Estruture por domínio:
  - `catalog/products`
  - `catalog/categories`
  - `catalog/variants`
- Evite módulos genéricos como `services/` ou `utils/` para regra de negócio de catálogo. Se existir util compartilhado, ele deve ser **explicitamente do domínio** (ex.: `catalog/pricing`, `catalog/inventory`).

## Reuso antes de criar (obrigatório)

Antes de criar qualquer coisa nova:

- Procure componentes existentes de UI (inputs, tabelas, paginação, filtros).
- Procure validações e schemas já existentes (ex.: Zod).
- Procure lógica existente de **preço**, **estoque** e **variação** para evitar duplicação.

Se existir uma implementação próxima, **estenda** ou **generalize** (após 3 repetições) ao invés de duplicar.

## Produtos (invariantes mínimos)

Produtos devem ser modelados/preparados para:

- **variações**: tamanho/cor/etc. com `variants` (ex.: SKU por variante).
- **estoque**: controle por SKU/variante e status de disponibilidade.
- **imagens**: lista ordenável, imagem principal e metadados básicos.
- **SEO**: `slug`, `title`, `description`/meta e preview (quando aplicável).
- **status**: draft/active/archived (ou equivalente).
- **destaque**: flag e/ou ordenação de destaque.

Regra: **não** replique regra de preço/estoque em mais de um lugar. Centralize em módulos do domínio (ex.: `catalog/pricing`, `catalog/inventory`).

## Categorias (invariantes mínimos)

Categorias devem suportar:

- **slug**: único no escopo definido (global ou por tenant).
- **SEO**: campos de meta (title/description) e texto de página (quando aplicável).
- **ordenação**: campo explícito (ex.: `sortOrder`) e regras claras.

## Evitar lógica duplicada (guardrails)

É proibido duplicar regra de:

- preço (promoção, preço base, moeda, regras por variante)
- estoque (disponível, reservado, backorder, mínimo, etc.)
- variação (composição de atributos, SKU, seleção)

Se a tarefa exigir mexer nesses pontos, crie/consuma **um** lugar canônico no domínio e faça os consumidores chamarem esse lugar.

## CRUD administrativo (backoffice) — requisitos mínimos

Todo CRUD administrativo relacionado a catálogo deve prever:

- **listagem** com estado vazio e loading
- **filtros** (ex.: status, categoria, texto)
- **paginação** (cursor ou offset, mas consistente)
- **validação** (schema central; erros legíveis)

Preferências:

- Componentes reutilizáveis para tabela/filtro/paginação.
- Mesma semântica de filtros para Products/Categories/Variants sempre que possível.

## Quando em dúvida

- Se a mudança “parece CRUD”, pergunte: **qual regra de domínio existe aqui?**
- Se a mudança “parece regra de domínio”, pergunte: **onde isso deve morar para não duplicar?**

## Recursos adicionais

- Exemplos práticos e templates: [examples.md](examples.md)
- Checklist e referência de decisões: [reference.md](reference.md)

