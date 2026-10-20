# Carrinho e avisos manuais de reposição

Implementado em 20/10/2026.

## Meta e sugestões

- O carrinho lateral lê `store_settings_public.free_shipping_threshold` pelo snapshot
  de conteúdo. Esse valor é editável em Configurações → Geral → Meta de frete grátis.
  Zero oculta o contador. Os campos antigos `shipping_free_enabled` e
  `shipping_free_min_value` pertencem ao checkout local aposentado e não são usados.
- Valor encontrado no início: R$ 299. Textos editoriais anunciam R$ 399. Nenhum valor
  foi alterado automaticamente: a loja deve manter a meta, os textos e a regra de
  frete da Yampi alinhados. A UI informa que as condições são confirmadas no checkout.
- `cartSuggestions.ts` calcula em centavos. Sugestões vêm da Shopify somente com o
  drawer aberto e meta pendente. Produtos já no carrinho e variantes esgotadas são
  excluídos; a ordenação prefere completar a meta com o menor excedente possível.
- Quando há várias variantes, o comprador escolhe cor/tamanho antes de adicionar.
  Preço, quantidade e disponibilidade continuam controlados pela Shopify. O checkout
  permanece exclusivamente Yampi, sem fallback para pagamento Shopify.

## Avisos de reposição

- Cliente escolhe a variante esgotada e usa “Avise-me quando chegar”. O formulário
  pede nome, WhatsApp com DDD, email e autorização para esse contato específico.
- `restock_requests` guarda o produto e a variante Shopify, contato, consentimento,
  status e data do aviso. Não é uma tabela de conteúdo da vitrine: **nunca incluir
  no snapshot público, localStorage de queries ou exportação pública**.
- Público só executa `submit_restock_request(jsonb)`. A RPC valida campos por
  constraints, normaliza telefone/email, ignora honeypot e retorna void. Impede
  duplicação de pedidos pendentes e limita a dez novos pedidos por email/dia.
- Somente admin pode listar, alterar ou excluir cadastros, com RLS por tenant.
  A migration é `supabase/migration-target/008_restock_requests.sql` (baseline
  externo, sem reaplicar as migrations históricas). Rollback documentado no arquivo.
- Em `/admin/avisos-reposicao`, filtros e paginação organizam os pedidos. A consulta
  à Shopify verifica a variante, não apenas a disponibilidade geral do produto.
- Por decisão do usuário, os avisos são **manuais**. WhatsApp e email abrem uma
  mensagem pronta quando a variante está disponível; “Já avisei” registra o envio
  informado pelo operador. Abrir o link não marca automaticamente como enviado.
  Não há envio automático, cron, provedor externo ou promessa de reserva do produto.

## Verificação

Testes de cálculo da meta/ordenação, formulário com consentimento, variante exata e
falha de envio. Banco validado em transação revertida: submissão anônima, deduplicação,
leitura e atualização administrativas. API anônima não permite listar contatos.
Teste real no navegador: Bota Cozy R$ 164,50 + sugestão Mule Camille R$ 134,50 atingiu
R$ 299,00; remoção do item voltou a exibir o restante. Nenhum pagamento realizado.
