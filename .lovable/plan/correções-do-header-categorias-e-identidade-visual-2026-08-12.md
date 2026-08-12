# Correções do header, categorias e identidade visual

Investiguei os 5 pontos no navegador e no banco. A maior parte dos problemas tem **uma única causa raiz**: as configurações públicas da loja (logo, texto do botão de destaque, contatos) não estão sendo lidas por visitantes não logados — a API pública retorna vazio, então o site cai no conteúdo antigo embutido no código.

## Causa raiz confirmada

A view pública `store_settings_public` está com `security_invoker = on`, o que faz o visitante anônimo esbarrar nas regras de acesso da tabela de origem (que só liberam para admins). Testado: a chamada pública retorna `[]`.

Consequências verificadas:
- O site usa a **logo antiga** (arquivo local com verde antigo) em vez da logo salva no painel — que já está no verde sálvia correto.
- O botão de destaque mostra **"Bijuterias"** (valor fixo de fallback no código), mesmo com o painel configurado com outro valor.
- Telefone/WhatsApp e outros dados do painel também não aparecem para visitantes.

## O que será feito

**1. Logo em verde sálvia**
- Liberar a leitura pública das configurações da loja, para que a logo cadastrada no painel (já no verde novo) seja usada em todo o site.
- Substituir também a imagem de fallback local pela versão em verde sálvia, para que nunca mais apareça a logo antiga, nem por um instante.

**2. Categorias no mobile**
- O menu mobile mostra apenas as 7 primeiras categorias. Passará a listar **todas** as categorias da Shopify, com rolagem, mantendo a ordem definida no painel.

**3. Compre por tamanho**
- Hoje essa seção lê tamanhos da base antiga (pré-Shopify), que não corresponde mais ao catálogo, por isso os links não levam a nada. Passará a montar a lista a partir das **variantes reais da Shopify que estão disponíveis**, alinhada com a página `/tamanho/:size` já existente.

**4. Trocar "Bijuterias" por promoções**
- Ajustar o destaque do header para **"Promoções"** apontando para `/promocoes` (rota já existente), tanto no painel quanto no fallback do código, com ícone de porcentagem.

**5. Verde claro no pré-carregamento**
- A cor padrão do CSS é um verde esmeralda vivo (`160 60% 50%`) que aparece na barra do topo até o tema do banco carregar. Será trocada pelo verde sálvia da marca (`#829778`), junto com os tons claro/escuro derivados, eliminando o "flash" de cor errada.

## Detalhes técnicos

- Migração: `alter view public.store_settings_public set (security_invoker = off);` — a view expõe apenas campos públicos (identidade visual, contatos da loja, regras de frete/parcelamento), sem dados de clientes.
- Atualização de dados: `store_settings.header_highlight_text = 'Promoções'`, `header_highlight_url = '/promocoes'`, `header_highlight_icon = 'Percent'`.
- `src/index.css`: `--primary`, `--accent`, `--accent-foreground` (light e dark) recalculados a partir de `#829778`.
- `src/components/store/Header.tsx`: menu mobile passa a usar `orderedCollections` completo; fallbacks do destaque atualizados.
- `src/components/store/ShopBySize.tsx`: troca a consulta Supabase por `useShopifyProducts({ first: 100 })`, extraindo opções de tamanho de variantes com `availableForSale`.
- `src/assets/logo.png`: substituído pela arte em verde sálvia.

## Validação

Depois das mudanças, verifico no navegador (desktop e mobile): logo em verde sálvia sem flash, botão "Promoções" no header, lista completa de categorias no menu mobile e links de tamanho levando a resultados reais.
