

# Plano: Correção da Sincronização de Variantes do Bling

## Problemas Identificados

1. **Tamanho (size)**: O campo `size` das variantes está armazenando o nome completo da variação (ex: "BIRKEN MARROM APLICAÇÃO PEROLA S690,634173 tamanho:35") ao invés de apenas "35"
2. **Cor (color)**: Sempre salva como vazio/null -- a cor não está sendo extraída dos dados do Bling
3. **SKU**: Frequentemente null -- não está sendo puxado corretamente da API
4. **Color hex**: Sem mapeamento automático para cores existentes no sistema
5. **Log de importação**: Está escondido dentro de um elemento colapsado difícil de encontrar

## Solução

### 1. Corrigir a extração de atributos das variações (Edge Function)

O Bling API v3 retorna variações com um campo `variacao` estruturado que contém `nome` (ex: "Tamanho:35;Cor:Preto") e separadamente o `codigo` (SKU). A função atual tenta parsear do `nome` da variação que contém o nome completo do produto.

**Correções no `bling-sync/index.ts`:**

- Usar o campo `variacao.nome` do detalhe da variação (quando disponível via API de detalhe) que contém apenas os atributos estruturados
- Melhorar o `parseVariationAttributes` para lidar com formatos como "TAMANHO:35", "tamanho:35", e também extrair tamanho de strings como "Tam. 35" ou apenas "35"
- Extrair o tamanho usando regex mais robusto que busca numeros no range 33-44 dentro do nome quando o parsing estruturado falha
- Extrair a cor de palavras-chave conhecidas no nome do produto (Preto, Branco, Marrom, etc.)

### 2. Mapeamento inteligente de cores

- Criar um mapa de cores conhecidas com seus hex codes (mesmas cores do `COMMON_COLORS` no `ProductVariantsManager.tsx`)
- Quando uma cor é extraída do Bling, fazer match fuzzy com as cores existentes no sistema
- Se a cor não existir na lista padrão, registrá-la mesmo assim (sem hex) para que apareça no painel

### 3. Mapeamento inteligente de tamanhos

- Quando o tamanho extraído do Bling é um numero (33-44), mapear diretamente para o tamanho padronizado
- Quando é texto (P, M, G, etc.), normalizar para uppercase
- Quando nada é encontrado, usar "Unico"

### 4. SKU original do Bling

- Garantir que o `codigo` da variação no Bling seja salvo como SKU na variante
- Buscar o SKU tanto do campo `codigo` do detalhe da variação quanto do `v.codigo` da listagem

### 5. Log de importação visível

- Mover o log de importação para uma seção sempre visível (não dentro de `<details>`)
- Adicionar filtros por status (erro, importado, atualizado, agrupado)
- Mostrar resumo claro com contadores

### 6. Filtrar produtos do tipo "Variação" do painel

- Garantir que apenas produtos do tipo "Simples" e "Com Variante" apareçam na listagem do painel admin
- Variações que foram importadas como produtos standalone devem ser limpas automaticamente

---

## Detalhes Tecnicos

### Alteracoes no `supabase/functions/bling-sync/index.ts`

1. **Nova funcao `extractAttributesFromBlingVariation`**: Recebe o objeto de detalhe da variacao do Bling e extrai size/color/sku de multiplas fontes:
   - `variacao.nome` (formato estruturado "Cor:X;Tamanho:Y")
   - `nome` do produto (busca por palavras-chave de cor e numeros de tamanho)
   - `codigo` para SKU

2. **Mapa `COLOR_MAP`**: Dicionario de cores conhecidas com hex codes, usado para:
   - Extrair cor do nome do produto quando nao vem estruturado
   - Salvar o `color_hex` junto com o nome da cor

3. **Melhorar `parseVariationAttributes`**: Regex mais robusto para extrair "tamanho:35" mesmo quando misturado com o nome do produto

4. **No `upsertParentWithVariants`**: Usar a nova funcao de extracao e salvar `color_hex` nas variantes

### Alteracoes no `src/pages/admin/Integrations.tsx`

1. Tornar o log de sincronizacao visivel por padrao (remover `<details>`)
2. Adicionar abas/filtros para ver apenas erros, importados, etc.
3. Melhorar a apresentacao visual do log

### Nenhuma alteracao de banco de dados necessaria

A tabela `product_variants` ja possui os campos `color_hex`, `sku`, `size`, `color` -- so precisam ser preenchidos corretamente.

