# Exemplos — Admin Data Table

## Exemplo 1: Produtos (painel admin)
Requisitos:
- Filtros: `status` (ativo/inativo), `categoria`, `preco` (range)
- Sort: `created_at`, `price`, `title`
- Busca: `q`
- Bulk: desativar/ativar, deletar

Decisões:
- URL como fonte da verdade (`page/perPage/sort/q/filters`)
- Query no servidor retorna `{ rows, total }`
- Tabela no client com TanStack Table + shadcn

## Exemplo 2: Pedidos
Requisitos:
- Filtros: `status`, `payment_status`, `date_range`
- Sort: `created_at`, `total_amount`
- Busca: `q` por `order_number`, `email`
- Ação por linha: ver detalhes, reemitir nota, reembolsar (se aplicável)

Pontos de atenção:
- Campos monetários: ordenar por centavos (inteiro) no banco
- Date range: normalizar timezone no servidor

## Exemplo 3: Clientes
Requisitos:
- Busca por nome/email/telefone
- Filtro por “newsletter opt-in”
- Paginação 50 por padrão

Modo recomendado:
- “modo simples” (CRUD rápido) é suficiente

## Exemplo 4: Coluna de imagem (banners/produtos)
Padrão:
- coluna renderiza thumbnail e fallback
- evite baixar arquivos pesados no client

Observação:
- se imagens estiverem em bucket privado, pode ser necessário um endpoint/rota para servir thumbnails com autenticação (mini CDN). Uma referência externa útil: `activenode/supabase-nextjs-image-api`.
