# Auditoria de custos Lovable Cloud

Data: 04/10/2026. Categoria informada: Cloud / banco e infraestrutura.
Escopo: código local, documentação e consultas SELECT no backend remoto. Nenhuma alteração em produção.

## Conclusão

O painel enviado pelo usuário confirma que Database server domina o consumo: 35,7 créditos, aproximadamente 97,9% do total visível. IA está em zero. A prioridade é verificar o tamanho da instância e seu tempo ativo, e migrar o backend; remover mídia ou chamadas de IA não ataca o principal custo medido. Há trabalho antigo ainda agendado no backend remoto, apesar das exclusões locais. Esses jobs podem manter atividade, mas não há evidência para atribuir a eles os 35,7 créditos.

### Painel enviado pelo usuário — Last 30 days

| Categoria | Run credits exibidos |
| --- | ---: |
| Database (total) | 36,3 |
| Database server (incluído no total) | 35,7 |
| Database storage (incluído no total) | 0,59 |
| Network | 0,16 |
| Storage | 0,02 |
| Compute | 0,0009 |
| AI | 0 |
| Connectors | 0 |

Total aproximado das categorias principais visíveis: 36,4809 créditos. Não somar novamente as subcategorias Database server/storage. Percentuais aproximados, pois os números do painel são arredondados. Realtime não aparece na lista visível; não foi inferido valor para ele. O gráfico mostra consumo diário relativamente estável nos dias ativos, compatível com custo de instância/tempo ativo, sem provar tamanho ou causa das interrupções. Conferir Advanced settings para tamanho atual e estimativa mensal. Créditos não foram convertidos em reais/dólares.

Projeto localizado: Vanessa Lima Shoes, `22c3ae85-378e-456f-a1fd-4eee29fb10eb`, workspace Studio Ninja. Cloud habilitado, stack Supabase. O host extraído dos comandos cron é `sojrvsbqkrbxoymlwtii`, o mesmo de `supabase/config.toml` e do cliente local.

## Evidências remotas

| Recurso | Medição | Interpretação |
| --- | --- | --- |
| Banco completo | 56.544.403 bytes (~53,9 MiB) | Inclui índices e estruturas; não informa custo de compute da instância |
| Storage product-media | 1.137 objetos; 308.537.538 bytes (~294,2 MiB), conforme metadata | Armazenamento persistente e possível tráfego de mídia |
| Histórico cron.job_run_details | ~13,7 MiB | Maior relação encontrada; histórico técnico pode receber retenção |
| bling_webhook_events | ~8,1 MiB | Estrutura antiga ainda ocupa espaço |
| bling_sync_runs / bling_webhook_logs | ~2,7 / ~1,5 MiB | Outros resíduos antigos |
| Última migration registrada | 20260812174733 | As três migrations de limpeza de outubro não aparecem aplicadas |

As estimativas `n_live_tup` retornaram zero para várias tabelas com espaço alocado. Não foram tratadas como contagens reais. Storage: 575 webp (~143,6 MiB), 542 jpg (~116,7 MiB), 1 mov (~20,5 MiB), 8 png e 11 jpeg. Esses totais não medem downloads nem faturamento.

### Jobs ativos e histórico dos últimos sete dias

| jobid | Nome | Cron | Execuções registradas |
| --- | --- | --- | --- |
| 3 / 6 | cleanup-daily-logs / cleanup_daily_logs | 30 3 * * * | 7 + 7 |
| 4 / 7 | cleanup-daily-storage / cleanup_daily_storage | 0 4 * * * | 7 + 7 |
| 5 / 8 | cleanup-weekly-optimize / cleanup_weekly_optimize | 0 5 * * 0 | 1 + 1 |
| 9 | cleanup_error_logs_10min | */10 * * * * | 990 |
| 10 | bling-stock-sync-daily-20h | 0 23 * * * | 7 |

Horários cron em UTC. Os seis jobs de limpeza apontam para `/functions/v1/cleanup-logs`; o código local preservado se chama `cron-cleanup-logs`. Há três pares com mesmo horário e mesmo endpoint: candidatos concretos à deduplicação, mas o payload de cada par precisa ser comparado antes de consolidar. O job Bling aponta para `/functions/v1/bling-webhook`.

Todos esses registros aparecem como `succeeded` no pg_cron. Isso confirma execução do comando SQL, não sucesso HTTP nem processamento correto na Edge Function. Não foram expostos comandos completos, credenciais, payloads ou dados de clientes.

## Chamadas encontradas no código

- `src/lib/staticContent.ts`: consultas GET/HEAD às 20 tabelas do snapshot são respondidas localmente fora de /admin. Esse conteúdo não gera consultas normais ao banco no storefront. Imagens/vídeos referenciados continuam remotos. Admin continua usando banco.
- `src/components/store/InstagramFeed.tsx`: todos os vídeos renderizados recebem src; o ativo usa preload auto e reprodução automática; os outros usam metadata. Pode gerar tráfego de vídeo mesmo sem interação. Confirmar download por visita e presença efetiva do componente no site publicado antes de estimar impacto.
- `src/pages/OrderConfirmation.tsx`: rota ainda ativa; busca pedido e itens locais. Visitante com guestToken consulta status a cada 15 segundos com aba visível (~240 consultas/hora enquanto montada), sem encerramento por status final. Outros visitantes usam Realtime. É dependência comercial antiga ainda presente, embora o checkout atual seja externo.
- `src/pages/admin/MediaGallery.tsx`: busca todas as product_images e nomes de products; paginação de exibição ocorre após a consulta. Storage lista até 500 objetos. É outro vínculo com catálogo antigo a retirar ou separar da mídia editorial.
- `src/hooks/useNotifications.ts`: define polling de 120 segundos, mas não há consumidores das duas funções no código atual. Não contabilizar como tráfego ativo. A página Notifications usa consulta própria paginada.
- `src/lib/sessionRecovery.ts`: getSession periódico não equivale necessariamente a requisição de rede; sessão pode estar em cache. Timers de carrossel também não são chamadas ao banco.
- `supabase/functions/cron-cleanup-logs/index.ts`: manutenção local ainda percorre tabelas e Storage; a versão remota e seus agendamentos precisam ser alinhados antes da migração.
- `supabase/retired-functions.json`: 33 endpoints retirados localmente. O manifesto não prova exclusão remota. Além dos jobs medidos, callbacks de provedores e scripts externos podem continuar chamando deployments antigos; verificar logs de invocação.
- `scripts/reservations-cleanup.mjs`, `scripts/reconcile-stale.mjs` e `scripts/load/checkout-sim.mjs`: referências antigas permanecem. Não há prova de execução automática; revisar agendadores externos.

Produtos e carrinho Shopify usam a API Shopify diretamente. O redirecionamento para Yampi usa a API pública de carrinho e deve ser preservado.

## IA e dependências Lovable

A única chamada de modelo encontrada está em `supabase/functions/seo-generate/index.ts`: gateway Lovable, `LOVABLE_API_KEY`, modelo `google/gemini-3-flash-preview`. Não é Claude. Não há chamador ativo no frontend/scripts atual. A função exige admin/service, mas não define limite de tokens, cache ou contabilização própria. Sua presença isolada não comprova gasto e não explica a categoria informada.

Google OAuth usa `@lovable.dev/cloud-auth-js` em `src/pages/Auth.tsx` e `src/integrations/lovable/index.ts`. Preview usa broker de sessão; vite usa lovable-tagger em desenvolvimento. Esses componentes não fazem chamadas de modelo por si só.

## Ordem de redução e migração

1. O painel Cloud → Usage já foi fornecido: priorizar Database server. Registrar tamanho atual da instância e estimativa mensal em Advanced settings; comparar com a necessidade real do conteúdo/admin/Auth/Billing. O painel identifica a categoria, mas não atribui custo a cada consulta ou job.
2. Validar e aplicar a retirada remota do Bling; comparar e consolidar jobs de limpeza; alinhar cleanup-logs com cron-cleanup-logs. Revisar necessidade do job a cada dez minutos e retenção do histórico cron. Não transportar esses jobs automaticamente para o novo projeto.
3. Publicar a versão limpa e retirar os endpoints remotos do manifesto. Verificar callbacks externos para não continuarem chamando o backend antigo. Preservar redirecionamento Shopify → Yampi e o Stripe Billing necessário ao SaaS.
4. Resolver OrderConfirmation e o catálogo antigo na MediaGallery; manter conteúdo/editorial necessário. Medir tráfego da mídia, comprimir/converter vídeo e carregar por visibilidade quando houver impacto comprovado.
5. Criar inventário seletivo para novo Supabase: conteúdo/admin, usuários e Auth, roles/RLS, Storage necessário, funções técnicas/SEO/Billing e segredos usados. Arquivar histórico comercial conforme necessidade; não recriar sincronização Bling/Yampi, estoque ou catálogo local.
6. Migrar schema/dados e políticas, usuários/Auth, arquivos/políticas de buckets e funções. Reconfigurar Google OAuth diretamente no Supabase, redirects, URLs de webhook e cron. Trocar VITE_SUPABASE_URL/chave pública; remover fallback do backend antigo e broker Lovable quando dispensável.
7. Reescrever URLs absolutas antigas em conteúdo do banco e contentSnapshot.json. Trocar env sozinho não altera essas URLs nem interrompe downloads no Storage antigo. Manter snapshot como fonte da vitrine.
8. Testar admin, login, mídia, conteúdo estático, Billing e checkout Yampi. Monitorar que o site deixa de chamar o backend antigo antes de desativá-lo. Exportar e conferir recuperação dos dados antes de qualquer exclusão definitiva.

Migrar para Supabase muda o fornecedor da infraestrutura, não elimina custos de compute, mídia e tráfego. Hospedagem do frontend precisa de decisão separada para sair integralmente do Lovable; Supabase cobre o backend. Não foram escolhidos projeto destino, plano ou host frontend nesta auditoria.

## Fontes

### Início da desativação remota — 04/10/2026

Autorizado pelo usuário e verificado por SELECT após execução:

- Desativado job 10, `bling-stock-sync-daily-20h`.
- Desativadas as dez flags de importação/sincronização da única configuração Bling existente.
- Desativados jobs 3, 4 e 5; preservados 6, 7 e 8. Conferidos mesmo horário, banco, usuário, URL e body de cada par. Os comandos completos diferem, portanto não foi usada igualdade textual como evidência de duplicação.
- Job 9 preservado, com frequência reduzida de dez minutos para uma hora (`0 * * * *`): 144 para 24 execuções previstas/dia. O nome histórico permanece; a exclusão de erros ocorre menos frequentemente, sem alterar o comando de retenção.
- UPDATE direto em cron.job foi recusado; o primeiro bloco DO foi revertido integralmente pelo PostgreSQL. Alterações concluídas via cron.alter_job e atualização separada das flags. Migration Bling local corrigida para usar a API cron; não foi registrada automaticamente no histórico de migrations.

Dados, arquivos e autenticação preservados. Banco ainda ativo. Não foram removidos deployments Edge Functions, callbacks externos ou o gateway de IA. Shopify → Yampi continua intacto. A redução de jobs não equivale a redução comprovada do custo de instância; migração e desligamento final continuam pendentes.

- [Lovable: Project usage and costs](https://docs.lovable.dev/features/project-usage): categorias, uso de instância, jobs, tráfego, Storage e distinção de chamadas de IA.
- [Lovable: Deployment, hosting and ownership](https://docs.lovable.dev/tips-tricks/deployment-hosting-ownership): portabilidade e migração de backend/hosting.
- Consultas SELECT realizadas no projeto acima: pg_database_size, pg_stat_user_tables, cron.job, agregados de cron.job_run_details, storage.objects e supabase_migrations.schema_migrations. Nenhuma consulta retornou dados de clientes ou segredos.

Limites: detalhamento em créditos obtido pela imagem enviada pelo usuário; sem conversão monetária, métricas de bytes transferidos, tamanho da instância ou logs HTTP das funções. A maior parte do consumo é Database server; ainda não há atribuição por consulta/job nem comprovação do tamanho da instância.
## Atualização após publicação no Supabase externo

Frontend permanece no Lovable; versão publicada aponta para incrfwanfvnrebztvffd.
Todos os jobs de cron da origem foram desativados e a contagem de jobs ativos
confirmada como zero. A infraestrutura Cloud antiga continua provisionada:
interromper os jobs não encerra a cobrança do servidor. O desligamento pelo painel
ficou pendente porque o usuário decidiu autenticar no Lovable posteriormente.
