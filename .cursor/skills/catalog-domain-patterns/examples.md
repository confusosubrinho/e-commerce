# Exemplos — Catálogo como domínio

## Exemplo 1 — “Criar CRUD de produtos”

**Entrada do usuário:** “Crie um CRUD de produtos no admin.”

**Resposta esperada do agente (como pensar):**

- Antes de criar rotas/telas: identificar invariantes do domínio (variação, estoque, preço, SEO, status, destaque).
- Verificar se já existem:
  - tabela + paginação + filtros no admin
  - schemas Zod para produto/categoria/variante
  - lógica de preço/estoque/variação em algum lugar canônico
- Implementar listagem com filtros e paginação como padrão mínimo.
- Centralizar validação no domínio; UI apenas consome.

## Exemplo 2 — “Adicionar destaque em produto”

**Entrada:** “Quero destacar produtos na home.”

**Checklist de decisão:**

- O destaque é:
  - booleano (`isFeatured`)?
  - ordenação (`featuredOrder`)?
  - ambos (flag + ordem)?
- Onde a regra vive:
  - `catalog/products` (modelo + validação)
  - `catalog/products/queries` (listagem por destaque)
- Garantir que o admin tenha filtro por destaque e ordenação coerente.

## Exemplo 3 — “Categoria com slug + SEO”

**Entrada:** “Categorias precisam de slug e SEO.”

**Como executar:**

- Definir campos mínimos: `name`, `slug`, `seoTitle`, `seoDescription`, `sortOrder`, `status` (se aplicável).
- Garantir unicidade de `slug` no escopo correto (global/tenant).
- Implementar validação:
  - slug obrigatório, normalizado
  - tamanho máximo de SEO title/description
- No admin: listagem com filtro por status e busca por nome/slug; paginação padrão.

## Exemplo 4 — “Variantes e estoque”

**Entrada:** “Produto precisa ter variações e estoque por variante.”

**Guardrails:**

- SKU deve ser por variante (ou regra explícita se SKU for no produto).
- Estoque deve referenciar SKU/variante em um lugar canônico (`catalog/inventory`).
- Não duplicar “cálculo de disponibilidade” em UI e API; a UI só exibe estados.

