# Operação da loja na Shopify — limpeza de 2026-10-04

> Estado atual: a **terceira etapa** abaixo prevalece sobre as dependências
> preservadas nas duas primeiras etapas. Por nova autorização, Yampi ficou
> somente no redirecionamento público do carrinho.

Este documento descreve o estado atual e prevalece sobre os inventários históricos
que ainda mencionam os módulos aposentados.

## Responsabilidades

- Shopify: catálogo, variantes, disponibilidade, carrinho e operação comercial.
- Admin local: aparência, mídia, páginas, blog, vitrines e configuração do site.
- Yampi: integração de checkout existente, preservada nesta limpeza.

## Removido do código

- Endpoints Bling OAuth, sincronização, webhook e sincronização de estoque individual.
- Reparo de imagens que buscava os arquivos no Bling.
- Helpers e testes exclusivos da integração Bling.
- CRUD local de produtos, variantes e estoque, categorias e avaliações.
- Telas locais de cupons, carrinhos abandonados, relatórios de vendas/tráfego,
  registro manual, automações de email, Commerce Health e logs/diagnóstico.
- Busca global de produtos/pedidos/clientes locais e métricas comerciais no dashboard.
- Monitoramento e limpeza periódica específicos do Bling.
- Cadastro local de avisos de reposição de estoque; disponibilidade continua vindo da Shopify.
- Persistência de erros do navegador no Supabase; diagnóstico técnico continua no console.
- Coleta local de sessões de tráfego e gravação automática de carrinhos abandonados no frontend.

O dashboard agora aponta para a Shopify e para a administração de conteúdo.
Não existe mais um toggle para reativar os módulos aposentados.

## Dependências preservadas

Nenhum arquivo `supabase/functions/yampi-*` ou `src/config/checkout.ts` foi editado.
Pedidos/clientes compartilhados, configuração de checkout, tabelas, tipos gerados,
RPCs de estoque e funções de checkout usadas pela Yampi permanecem.
O estoque desses fluxos compartilhados não foi removido: fazer isso alteraria a Yampi.

O arquivo `_shared/blingStockPush.ts` conserva o contrato chamado pelo webhook
Yampi, mas responde `success: true, skipped: true`, sem banco, rede ou movimentação
de estoque. É a única alteração indireta: o envio de pedidos ao Bling foi aposentado.

Migrations antigas ficam como histórico e continuam necessárias para reconstruir
o banco. Dados comerciais e logs históricos não são apagados nesta etapa.

## Publicação e Supabase remoto

Excluir o código de uma Edge Function não exclui uma função já publicada.
A limpeza local, por si só, não desliga endpoints remotos.

1. Aplicar a migration `20261004220000_retire_bling_sync.sql` em staging e validar.
   Ela desliga flags de sincronização e jobs que chamam exclusivamente endpoints Bling.
2. Excluir no projeto Supabase os endpoints `bling-oauth`, `bling-sync`,
   `bling-sync-single-stock`, `bling-webhook` e `admin-repair-images`.
3. O helper compartilhado também precisa ser incluído em um deploy para interromper
   envios ao Bling por consumidores já publicados. O webhook Yampi não foi republicado
   nesta etapa, respeitando o pedido de não alterar a Yampi agora.
4. Publicar o frontend atualizado. Remover credenciais Bling do ambiente após
   confirmar que nenhum deployment antigo depende delas.

Nenhuma migration ou exclusão remota foi executada nesta limpeza.

## Segunda etapa — remoção do frontend legado

- Excluídos o CartContext/provider e componentes de compra, variantes, cupons,
  frete, sugestões e vitrines que dependiam do catálogo Supabase.
- Excluídos helpers sem consumidores de preço do carrinho, cupons, cache de frete
  e produtos recentes, junto com os testes das funcionalidades aposentadas.
- Busca rápida consulta a Shopify e usa os handles nas rotas dos produtos.
- Favoritos usam handles Shopify e ficam salvos neste navegador. Favoritos antigos
  no banco não são apagados nem migrados automaticamente; não há mais sincronização
  de favoritos por conta nesta vitrine.
- Configuração do cabeçalho usa coleções Shopify e salva sua ordem por handle,
  como o menu da vitrine espera. O editor de seções não oferece catálogo local.
  Seções antigas por categoria/IDs exigem escolher uma coleção Shopify ao editar.
- Excluídos importador Tray, script Appmax do storefront, callback administrativo
  Appmax e painéis de Stripe/Appmax/frete local. A página de integrações aponta
  para Shopify e mantém acesso à configuração de checkout existente.
- Hooks de banners/configurações ficaram em `useStoreContent.ts`; o snapshot de
  conteúdo continua preservado. Conteúdo editorial e mídia não foram apagados.

### Backend preservado por dependência

Os endpoints de Stripe/Appmax e o router compartilhado não foram excluídos:
`CheckoutSettings`, sessões e o router ainda os referenciam, e o router também
cria sessões para Yampi. Remover essa cadeia mudaria o fluxo protegido.
Stripe também possui código de assinaturas da plataforma (billing), que não é
estoque/operação da loja. Tabelas, RPCs e logs compartilhados permanecem.
Todos os arquivos `yampi-*`, os testes Yampi e a configuração de checkout seguem
sem alterações nesta segunda etapa.

### Migration de retirada do schema Bling

`20261004223000_archive_retired_bling_schema.sql` foi preparada, mas não aplicada.
Ela copia as quatro tabelas Bling e os campos `bling_*` de produtos, variantes,
pedidos e configurações para `retired_integrations`, schema privado com RLS,
e os retira de `public`. Não apaga as linhas de produtos/pedidos ou campos Yampi.
Usa `RESTRICT`: dependências desconhecidas abortam toda a transação.
Os tipos TypeScript foram ajustados para esse schema planejado; não foram
regenerados de um banco remoto.

Antes de aplicar: retirar deployments antigos (incluindo o envio indireto ao
Bling), guardar `pg_dump` do schema e validar em staging. O rollback está
documentado na migration e usa as cópias por ID, sem sobrescrever pedidos novos.
Credenciais Bling arquivadas precisam ser revogadas ao concluir a retirada.
Excluir também a função remota `integrations-tray-import` e seus jobs/agendamentos.
Esta etapa não fez deploy, migração remota ou teste SQL em PostgreSQL/staging.

### Validação da segunda etapa

- TypeScript (`tsc --noEmit`) e build Vite passaram.
- 26 arquivos de teste, 148 testes passaram, incluindo os 30 testes de preço Yampi.
- Verificação de imports locais: nenhum arquivo ausente.
- Comparação com Git: 13 arquivos protegidos da Yampi/checkout sem alterações.
- Lint dos arquivos alterados: sem novos erros; existem erros `any` anteriores
  no cabeçalho, editor de seções e card Shopify.

## Terceira etapa — Yampi somente no redirecionamento

O usuário autorizou retirar também os controles de produtos e operação Yampi,
preservando apenas o redirecionamento do carrinho. Não é mais necessário manter
as dependências comerciais que haviam sido protegidas nas etapas anteriores.

### Removido

- Todos os oito endpoints locais `yampi-*`: catálogo, imagens, categorias, SKUs,
  valores de variantes, status, importação de pedidos e webhook.
- Configuração administrativa de checkout/gateways, pedidos/clientes e revisão
  de pagamentos divergentes; imports, rotas e detalhe de pedido correspondentes.
- Router, criação de sessões, pagamento, cotações de frete, reservas/expiração,
  reconciliação e reprocessamento do checkout comercial local.
- Endpoints Appmax, sincronização de catálogo/intent Stripe, teste de integração
  e ações comerciais administrativas.
- Helpers Yampi/Bling/Appmax, contratos e clientes de checkout aposentados, seus
  testes e campos de sincronização Yampi dos tipos/snapshot. Segredos Yampi e
  Appmax deixaram o exemplo de ambiente.
- Retenção de logs comerciais no cron técnico; dados comerciais históricos
  deixam de ser apagados automaticamente por esse cron.

### Preservado

`src/config/checkout.ts`, `src/pages/Cart.tsx`, `ShopifyCartDrawer.tsx` e o store
do carrinho Shopify continuam iguais ao Git. O botão envia variantes Shopify e
quantidades à API pública do checkout externo e redireciona à URL recebida.
O fallback de permalink Shopify e o domínio seguro também continuam.
Os campos de produto no payload são necessários para transportar o carrinho;
não representam sincronização ou controle de catálogo.

Stripe Billing foi preservado no mesmo endpoint `checkout-stripe-webhook`,
agora somente com eventos de assinatura. Pagamentos de pedidos são ignorados;
não há escrita em pedidos, pagamentos ou estoque. Usa segredos do ambiente,
sem consultar a antiga tabela de provedores comerciais.
Conteúdo, mídia, autenticação, histórico de negócios e SEO permanecem.

### Banco e publicação

`20261004230000_retire_local_commerce_control.sql` está preparada e **não aplicada**.
Desativa jobs aposentados, retira views/configurações comerciais e funções/triggers
de estoque local, arquiva configurações/logs exclusivos e os campos `yampi_*`
em schema privado com RLS. Dados de produtos, variantes, estoque histórico,
pedidos, pagamentos e clientes não são apagados. O rollback usa cópias privadas
e definições SQL arquivadas, junto com `pg_dump` prévio. `RESTRICT` aborta diante
de qualquer dependência desconhecida; não se usa `CASCADE`.

O manifesto completo de funções a excluir está em `supabase/retired-functions.json`.
Antes das migrations de retirada: guardar backup, validar em staging, retirar
TODOS esses deployments/agendamentos e publicar os handlers preservados
(Stripe Billing e cron técnico). Não republicar endpoints `yampi-*` removidos.
Desativar também webhooks de importação/sincronização no painel Yampi, preservando
o checkout/app Shopify e a API pública de carrinho usados no redirecionamento.
Revogar segredos antigos após concluir. SQL não foi executado/testado contra
PostgreSQL remoto nesta etapa.

Migrations/documentação históricas mantêm nomes antigos para reconstrução e
auditoria. No código ativo, a integração Yampi ficou somente no redirecionamento
e nos testes que garantem esse contrato.

### Validação final

- 18 arquivos de teste, 104 testes passaram (incluindo 6 de redirecionamento e
  4 do handler real Stripe Billing com dependências simuladas).
- TypeScript e build Vite passaram; handlers Deno alterados passaram na
  verificação de sintaxe. Não houve teste contra APIs reais ou PostgreSQL.
- Nenhum import local quebrado; quatro arquivos do carrinho/redirecionamento
  permanecem iguais ao Git.
- Lint dos arquivos finais e testes novos passou; o lint geral ainda contém
  problemas anteriores fora dessa validação.
