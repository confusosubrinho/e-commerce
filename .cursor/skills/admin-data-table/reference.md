# Referência — Admin Data Table

## Contrato de query params (detalhado)

### `page`
- Inteiro \(>= 1\)
- Default: 1

### `perPage`
- Inteiro em whitelist (ex.: 10/20/50/100)
- Default: 20
- Clamp: se vier algo fora da whitelist, cair no default

### `sort`
Formato: `campo.direcao`
- `campo`: whitelist (ex.: `created_at`, `price`, `title`)
- `direcao`: `asc | desc`

Regras:
- Se inválido, use default (ex.: `created_at.desc`)
- Nunca repasse direto pro SQL sem whitelist

### `q`
Busca simples (string):
- Trim
- Limite de tamanho (ex.: 100 chars)
- Se vazio, tratar como undefined

### `filters`
Opções:
1) Um único param `filters` com JSON URL-encoded
2) Params múltiplos por filtro (ex.: `status=active&status=inactive`)

Recomendação:
- Use JSON URL-encoded quando precisar de filtros avançados (range, date range, condições).
- Sempre valide no servidor.

Exemplo de shape (conceitual):
- `status`: `string[]`
- `category_id`: `string | null`
- `price`: `{ min?: number; max?: number }`
- `created_at`: `{ from?: string; to?: string }` (ISO)

## Toolbar (UX mínima)
- Campo de busca (`q`)
- Chips de filtros ativos
- Botão “Limpar filtros”
- Ações (ex.: “Novo produto”)

## Paginação
Server-side:
- `offset = (page - 1) * perPage`
- `limit = perPage`
- Retornar `total` (count) separado de `rows`

Client:
- `pageCount = ceil(total / perPage)`
- Navegação: first/prev/next/last

## Bulk actions (seleção)
Regras:
- Seleção deve sobreviver a re-render local, mas não a mudanças bruscas de query (ex.: filtros/página)
- Ao aplicar ação:
  - mostrar confirmação se for destrutiva
  - executar no servidor
  - revalidar lista

## Anti-patterns (evitar)
- Client buscar tudo e filtrar no browser para listas grandes (vira lento e quebra permissões).
- Sort/filters “livres” vindo do client (risco de SQL injection / quebra de índices / enumeração).
- Estado duplicado: URL diz uma coisa, tabela diz outra.
- `useEffect` para “sincronizar tudo” sem necessidade; prefira fonte única (URL) e eventos do usuário.

## Inspirações externas
- Referência principal (padrão completo): `sadmann7/tablecn` ([repo](https://github.com/sadmann7/tablecn?utm_source=chatgpt.com))
- Alternativa simples (CRUD rápido): `pankajgurav005/next-shadcn-data-table` ([repo](https://github.com/pankajgurav005/next-shadcn-data-table?utm_source=chatgpt.com))
- Para coluna de imagem com storage privado (opcional): `activenode/supabase-nextjs-image-api` ([repo](https://github.com/activenode/supabase-nextjs-image-api?utm_source=chatgpt.com))
