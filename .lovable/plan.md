

# Diagnóstico: Vinculação de IDs entre Site e Yampi

## Problema Central

O fluxo atual depende **exclusivamente** de `metadata.session_id` para vincular um pedido pré-criado no site ao pedido gerado na Yampi. Se a Yampi não devolver esse campo no webhook (comportamento documentado como inconsistente), o webhook **cria um segundo pedido**, gerando duplicidade, estoque debitado em dobro e dados inconsistentes.

```text
FLUXO ATUAL (com falha):

checkout-router          checkout-create-session         Yampi API
     │                          │                           │
     │── cria order (pending) ──│                           │
     │                          │── cria payment-link ──────│
     │                          │◄─ retorna link_url ───────│
     │◄─ session_id ────────────│                           │
     │── update order           │                           │
     │   checkout_session_id    │                           │
     │                          │                           │
     │                    [CLIENTE PAGA NA YAMPI]            │
     │                          │                           │
     │                    yampi-webhook ◄────────────────────│
     │                          │                           │
     │          metadata.session_id presente?                │
     │              SIM → atualiza order existente           │
     │              NÃO → CRIA NOVO ORDER (BUG!)            │
```

## Bugs Identificados

### Bug 1 (CRÍTICO): Nenhum ID da Yampi é salvo no pedido pré-criado
**Arquivo:** `checkout-create-session/index.ts` linha 342-350 e `checkout-router/index.ts` linha 358-361

O `checkout-create-session` retorna apenas `session_id` (UUID interno) e `redirect_url`. Não extrai nem retorna o ID do payment link da Yampi (ex: `linkData.data.id`). O `checkout-router` salva apenas `checkout_session_id` — nunca salva `external_reference` com o ID Yampi.

Resultado: o pedido local não tem nenhuma referência ao ID da Yampi até o webhook chegar. Se o webhook não traz `metadata.session_id`, não há como vincular.

### Bug 2 (CRÍTICO): Webhook sem fallback quando metadata.session_id é null
**Arquivo:** `yampi-webhook/index.ts` linha 71

`const sessionId = resourceData?.metadata?.session_id || null;`

Se a Yampi não inclui metadata no webhook (comportamento comum em certos tipos de evento), `sessionId` é null. O webhook não encontra o pedido por `external_reference` (porque não foi salvo) nem por `checkout_session_id`. Cai no bloco de inserção (linha 312) e cria um pedido duplicado.

### Bug 3: Sem mecanismo de reconciliação por SKUs/valor
Quando o webhook não consegue vincular por session_id, deveria tentar casar o pedido por combinação de: valor total + itens (yampi_sku_ids) + status pending + janela de tempo recente. Isso não existe.

### Bug 4: `checkout-create-session` não extrai o Yampi link/order ID da resposta
**Arquivo:** `checkout-create-session/index.ts` linhas 342-350

A resposta da API Yampi (`linkData.data`) contém um `id` do payment link. Esse ID poderia ser salvo como `external_reference` no pedido, criando o vínculo antes do webhook chegar.

## Plano de Correções

### Correção 1: Extrair e retornar o Yampi payment link ID no `checkout-create-session`
Quando a Yampi retorna a resposta do payment-link, extrair `linkData.data.id` ou `linkData.id` e retornar junto com `session_id` e `redirect_url`.

### Correção 2: Salvar `external_reference` no pedido pré-criado via `checkout-router`
Após receber o ID do payment link da Yampi, atualizar o pedido com `external_reference` além de `checkout_session_id`. Isso garante que mesmo sem metadata, o webhook pode encontrar o pedido.

### Correção 3: Adicionar fallback de busca no webhook por pedidos pending recentes
Quando o webhook não encontra por `external_reference` nem `checkout_session_id`, buscar pedidos `pending` dos últimos 30 minutos que tenham os mesmos `yampi_sku_id` nos `order_items` e valor total compatível. Se encontrar exatamente 1, vincular.

### Correção 4: Webhook deve tentar buscar por `cart_id` como fallback adicional
Se a Yampi enviar algum identificador do carrinho no payload, usar como critério extra de busca.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/checkout-create-session/index.ts` | Extrair e retornar Yampi link ID da resposta |
| `supabase/functions/checkout-router/index.ts` | Salvar `external_reference` com Yampi link ID no pedido pré-criado |
| `supabase/functions/yampi-webhook/index.ts` | Adicionar fallback de busca por pedidos pending quando session_id e external_reference falham |

## Impacto
- Elimina a criação de pedidos duplicados quando Yampi não envia metadata
- Garante vínculo bidirecional entre pedido local e pedido Yampi desde o início
- Adiciona camada de segurança com reconciliação por valor+itens como último recurso

