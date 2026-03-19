# Referência — Catálogo (Products / Categories / Variants)

## Checklist de revisão (rápido)

- [ ] Organização por domínio (`catalog/products|categories|variants`)
- [ ] Reuso: componentes e validações existentes foram reaproveitados
- [ ] Produtos cobrem variação/estoque/imagens/SEO/status/destaque
- [ ] Categorias cobrem slug/SEO/ordenação
- [ ] Sem duplicação de regra de preço/estoque/variação
- [ ] Admin: listagem + filtros + paginação + validação

## Padrão mínimo de listagem (admin)

**Obrigatório:**

- Campos de filtro:
  - texto (nome/sku/slug)
  - status (active/draft/archived ou equivalente)
  - categoria (quando fizer sentido)
- Paginação:
  - escolha 1 abordagem (cursor ou offset) e aplique em todos os CRUDs do catálogo
- Ordenação:
  - default consistente (ex.: `updatedAt desc` ou `createdAt desc`)
- Estados de UI:
  - loading / empty / error / success

## Campos sugeridos por entidade (orientativo)

### Product

- Identidade: `id`, `name`, `slug`
- Status: `status`
- Conteúdo: `description` (ou equivalente)
- SEO: `seoTitle`, `seoDescription`
- Destaque: `isFeatured` e/ou `featuredOrder`
- Imagens: coleção ordenada (ex.: `images[]` com `url`, `alt`, `sortOrder`, `isPrimary`)
- Relações: `categoryId(s)` (se aplicável)

### Variant

- Identidade: `id`, `productId`, `sku`
- Atributos: conjunto (ex.: cor/tamanho) — modelar como lista/chave-valor
- Preço: referenciar regra canônica (não duplicar cálculo)
- Estoque: referenciar regra canônica (não duplicar disponibilidade)
- Status: `status` (se aplicável)

### Category

- Identidade: `id`, `name`, `slug`
- SEO: `seoTitle`, `seoDescription`
- Ordenação: `sortOrder`
- Relações: `parentId` (se hierárquico)
- Status: `status` (se aplicável)

## Onde a regra deve morar (canônico)

Quando surgir necessidade de regra de negócio:

- Preço:
  - criar/usar um módulo canônico do domínio (ex.: `catalog/pricing/*`)
  - UI e queries chamam esse módulo
- Estoque:
  - criar/usar um módulo canônico do domínio (ex.: `catalog/inventory/*`)
  - a lógica de “disponível / indisponível” não deve ficar duplicada na UI
- Variações:
  - criar/usar um módulo canônico (ex.: `catalog/variants/*`) para:
    - composição de atributos
    - validação de SKU
    - regras de seleção

## Anti-patterns (não fazer)

- Duplicar schema/validação do mesmo objeto em múltiplos lugares.
- Duplicar cálculo de preço/estoque/seleção de variante em telas diferentes.
- Implementar admin sem filtros/paginação (vira débito técnico imediato).
- Misturar domínio de catálogo com checkout/pedidos; manter bounded context claro.

