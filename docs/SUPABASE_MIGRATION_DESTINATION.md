# Destino da migração

Informado pelo usuário em 04/10/2026:

- URL: https://incrfwanfvnrebztvffd.supabase.co
- Project ref: incrfwanfvnrebztvffd
- Origem: sojrvsbqkrbxoymlwtii (Lovable Cloud).

Destino registrado; nenhuma configuração ativa do frontend foi trocada. A URL
não fornece acesso administrativo nem a chave pública do projeto. Conferir
schema, Auth e Storage existentes antes de importar para evitar conflitos.

## Acesso confirmado em 04/10/2026

CLI autenticada pelo usuário. `supabase/.temp/project-ref` aponta para
`incrfwanfvnrebztvffd`. Projeto Vanessa Lima Shoes, região sa-east-1,
status ACTIVE_HEALTHY. Consultas via `db query --linked` confirmaram:

- Nenhuma tabela em public.
- Zero usuários Auth, buckets e objetos Storage.

Exportados somente metadados de estrutura da origem para
`supabase/migration-source-schema.json`: 1.000 colunas, constraints,
políticas e views. Isso não é backup de dados ou usuários. Inventário gerado
por `node scripts/prepare-migration-inventory.mjs` em
`supabase/migration-inventory.json`. Candidatos precisam de revisão de
dependências, RPCs, triggers e permissões antes de criar schema no destino.

Ainda existem referências de código a pedidos, reviews e catálogo local;
não recriar essas tabelas automaticamente para contornar referências antigas.
Dados e configurações do destino não foram alterados.

## Migração aplicada — 04/10/2026

O registro acima descreve a inspeção inicial. Depois, com autorização do usuário:

- Aplicado baseline seletivo de 36 tabelas, índices, constraints, funções de
  autorização e políticas RLS. Criada a view store_settings_public. Nenhuma
  tabela de Bling, catálogo/estoque, pedidos locais ou sincronização Yampi criada.
- Conteúdo e configuração importados. Contagem final: 110 registros públicos
  distribuídos pelas tabelas selecionadas; logs históricos não copiados.
- Inicialmente copiadas as 13 contas da origem; por confirmação explícita do
  usuário, removidas 12 do destino. Estado final: um usuário, uma identidade
  email/senha, um papel admin. IDs e hash da senha do administrador preservados.
  Origem intacta. Backup privado conserva o estado anterior à redução.
- Novos cadastros bloqueados em Auth; site_url e URLs de retorno configurados
  para domínio público e desenvolvimento local. Login Google segue desativado.
- Criado bucket product-media com leitura pública da mídia editorial e escrita
  limitada ao admin. Copiados e verificados via HTTP os 22 arquivos disponíveis,
  em product-media/media/. Cinco referências já indisponíveis na origem:
  três vídeos, um favicon e uma imagem. Vídeos desativados; imagens substituídas
  por placeholder. É necessário reenvio para recuperar esses conteúdos.
- URLs do conteúdo importado e snapshot estático atualizadas para o Storage
  novo. Snapshot continua atendendo a vitrine; admin usa banco.
- Publicada somente cron-cleanup-logs. Sem agendamentos novos. Não publicados
  endpoints aposentados nem SEO IA. Sitemap e robots do frontend são estáticos.
- Não havia clientes/assinaturas Stripe cadastrados nas tabelas tenants da
  origem; Billing não foi ativado no destino. Se necessário posteriormente,
  configurar segredos e webhook antes de ativar a função.
- Preparadas .env.local e .env.migration.local com URL/chave pública novas,
  ambas ignoradas pelo Git. Removido fallback do cliente para o backend antigo
  e o broker de sessão Lovable. A hospedagem publicada ainda precisa receber
  a configuração nova e o build atualizado.
- Removidas chamadas de catálogo da galeria e do conteúdo de Instagram;
  retirados pedidos locais da conta e avaliações locais da página de produto.
  Confirmação antiga redireciona a rastreio, que usa código de envio externo.
  Os quatro arquivos protegidos do carrinho/redirecionamento Yampi não mudaram.

### Validação

- 18 arquivos, 104 testes passaram.
- TypeScript com tsconfig.app.json passou; build completo passou, incluindo
  sitemap Shopify com 112 URLs.
- API anônima: configuração pública visível; perfis e papéis retornam zero
  registros. SQL sob papel authenticated confirmou is_admin e acesso ao
  store_settings; atualização de banner testada com ROLLBACK.
- Todas as 36 tabelas com RLS; 22/22 arquivos acessíveis; signup bloqueado.
- Lint dos arquivos novos de galeria/rastreio/cliente passou.

### Próximo passo para concluir a troca

1. Testar login real do administrador em http://127.0.0.1:8080/admin/login com
   a senha existente. O hash foi preservado, mas a senha não foi solicitada
   nem um login real foi executado pelo agente.
2. Frontend permanece hospedado no Lovable, conforme decisão do usuário.
   Configurar no ambiente de build do Lovable VITE_SUPABASE_URL e
   VITE_SUPABASE_PUBLISHABLE_KEY do destino e publicar o código atualizado.
   .env.local ignorado pelo Git não configura automaticamente o Lovable.
   Hospedagem e domínio atuais permanecem; não criar Vercel/Cloudflare Pages.
3. Verificar login, admin, mídia e checkout no domínio publicado; conferir que
   não existem chamadas ao backend antigo. Só depois desativar Cloud de origem.

Os arquivos .migration-private incluem dados pessoais e hashes de senha e
não devem ser enviados ao Git, frontend, hospedagem estática ou terceiros.
Os arquivos SQL em migration-target são um baseline separado das migrations
históricas e não devem ser reaplicados em banco já preenchido.

Decisão de hospedagem registrada em 04/10/2026: frontend no Lovable, backend
no Supabase externo incrfwanfvnrebztvffd. Desligar apenas o backend Cloud
antigo depois de validar a publicação. Isso não significa encerrar a conta
Lovable nem excluir o projeto ou o site publicado.

Próximos requisitos:

1. Acesso autenticado ao projeto destino pelo painel/CLI/conector para inspecionar
   estrutura, criar schema e políticas, configurar Auth, Storage e funções.
2. Chave publishable/anon do destino para configurar o frontend após importar
   e validar. A chave pública não substitui acesso administrativo.
3. Exportação recuperável da origem, inventário seletivo de dependências e
   transferência dos arquivos necessários; não reaplicar cegamente todas as
   migrations históricas, que recriam módulos comerciais aposentados.
4. Configurar Google OAuth, segredos e webhook Stripe Billing quando necessário.
5. Validar dados, permissões, login e conteúdo; reescrever URLs de mídia antigas
   no banco e snapshot; preservar carrinho Shopify → Yampi.
6. Definir hospedagem do frontend, efetuar a troca e verificar ausência de
   tráfego ao backend antigo antes do desligamento final.

Credenciais administrativas e senha de banco devem ser configuradas por canal
seguro/local, sem serem registradas neste documento ou no Git.
