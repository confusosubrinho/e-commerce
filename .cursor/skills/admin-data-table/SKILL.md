---
name: admin-data-table
description: Implementa tabelas/listagens de painel admin com shadcn/ui + TanStack Table, com paginação/ordenação/filtros server-side e UX de toolbar. Use quando o usuário mencionar painel admin, backoffice, listagens, tabela, data table, shadcn, TanStack Table, paginação, sorting, filtros, busca, bulk actions, produtos, pedidos, clientes, cupons ou banners.
---

# Admin Data Table (Painel)

Skill para construir **tabelas/listagens administrativas** com:
- **shadcn/ui** (Table, Button, Input, Dropdown, Badge, Dialog)
- **TanStack Table** (`@tanstack/react-table`)
- **Server-side**: paginação, ordenação, filtros (e busca)

Referências pragmáticas:
- Padrão completo inspirado em `sadmann7/tablecn`
- Alternativa simples (CRUD rápido) inspirado em `pankajgurav005/next-shadcn-data-table`

## Objetivo (o que “bom” significa)
- **URL é a fonte da verdade**: estado da tabela vai em query params (page, perPage, sort, filters, q).
- **Query no servidor**: o client só controla estado/UX; o servidor valida e executa a consulta.
- **Estados obrigatórios**: loading, error, empty, success.
- **Bulk actions**: seleção de linhas com ações (ex.: deletar, ativar/desativar, exportar).

## Contrato de URL (padrão recomendado)
Padronize estes parâmetros (nomes consistentes entre listagens):
- `page`: 1..N
- `perPage`: 10/20/50/100
- `sort`: `campo.direcao` (ex.: `created_at.desc`, `price.asc`)
- `q`: busca textual simples (opcional)
- `filters`: string serializada (recomendado JSON compactado/URL-encoded) **ou** múltiplos params `f_*`

Regras:
- **Sempre validar/sanitizar no servidor** (ex.: Zod).
- **Nunca confiar no client** para filtros/sorts (especialmente em admin multi-tenant).

## Workflow “modo completo” (tablecn-like)
1. **Defina o modelo de dados e colunas**
   - Colunas com `id`, `header`, `accessorKey`/`accessorFn`.
   - Colunas de ação: menu de linha (editar, duplicar, deletar).
   - Coluna de seleção (checkbox) para bulk actions.

2. **Defina filtros como “metadados”**
   - Ex.: `status` (multi-select), `category_id` (single), `price` (range), `created_at` (date range).
   - Gere UI da toolbar baseada nessas definições (evite duplicação).

3. **Parse e valide query params no servidor**
   - `page/perPage/sort/q/filters`.
   - Normalize valores (ex.: `page` mínimo 1; clamp em limites).

4. **Monte a query server-side com total**
   - Retorne `{ rows, total }`.
   - Use `total` para `pageCount = Math.ceil(total / perPage)`.
   - Otimize: índices nos campos filtráveis; evite `ILIKE %...%` sem estratégia.

5. **Renderize a tabela no client (mínimo “use client”)**
   - O componente de tabela pode ser client.
   - Os dados devem vir do servidor (RSC/loader/API) já paginados/ordenados.

6. **Sincronize interações com URL**
   - Ao mudar `page/perPage/sort/filtros`, atualize a URL (router push/replace).
   - Revalidar/refetch no servidor.

## Workflow “modo simples” (CRUD rápido)
Use quando a listagem é pequena e você só precisa do básico:
- `page/perPage/sort` no servidor
- filtros simples: `q` e 1–2 selects
Sem “advanced filtering” complexo.

## Checklist de qualidade (admin)
- **Permissões**: servidor valida que o usuário pode listar/ler/alterar.
- **Isolamento**: se multi-tenant, toda query deve filtrar por `tenant_id`/`store_id`.
- **Colunas estáveis**: IDs previsíveis; evite `accessorFn` sem memo quando pesado.
- **UX**:
  - toolbar com busca + filtros + “limpar filtros”
  - estado vazio com CTA (ex.: “Criar produto”)
  - paginação com `perPage`
  - feedback em bulk actions (toast + refetch)

## Padrões de componentes (sugestão)
Organize por domínio (painel):
- `src/<dominio>/admin/<entidade>/list/`
  - `columns.tsx`
  - `filters.ts`
  - `table.tsx`
  - `toolbar.tsx`
  - `query.ts` (parse/validate + montagem de query)

## Recursos
- Exemplos de uso: veja [examples.md](examples.md)
- Referência detalhada (contratos, filtros, URL, anti-patterns): veja [reference.md](reference.md)
