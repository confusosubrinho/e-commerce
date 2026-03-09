
# Auditoria Yampi — Rodada 4: Comunicação e Sincronização de Dados

---

## Problemas Encontrados

### CRITICO

**Y31. yampi-sync-images: Não usa `fetchWithTimeout` — chamadas à API podem travar indefinidamente**
- `yampi-sync-images/index.ts` linhas 33, 101, 130, 249, 321, 350 — Todas as chamadas `fetch()` são feitas diretamente sem timeout. Se a API Yampi travar ou demorar excessivamente, a Edge Function fica pendurada até o timeout do Deno (60s).
- **Impacto**: Sincronização de imagens pode ficar travada sem feedback útil. Admin precisa aguardar timeout completo.
- **Fix**: Substituir todas as chamadas `fetch()` por `fetchWithTimeout()` com 25s.

**Y32. yampi-sync-images: Não verifica resultado do upload no storage antes de enviar URL à Yampi**
- `yampi-sync-images/index.ts` linhas 114, 139, 159 — O código faz upload para o storage e imediatamente pega `getPublicUrl()`, mas não verifica se o upload teve sucesso real (apenas checa `error`). Se o upload falhar silenciosamente, a URL enviada à Yampi pode não existir.
- **Impacto**: Imagens podem aparecer como "sincronizadas" mas estar quebradas na Yampi.
- **Fix**: Após upload, fazer um HEAD request para validar que a URL está acessível antes de enviar à Yampi.

### ALTO

**Y33. checkout-create-session: Não sincroniza cupom/desconto com link de pagamento Yampi**
- `checkout-create-session/index.ts` linhas 296-316 — O payload do payment link não inclui nenhum campo de desconto ou cupom (`discount_amount`, `coupon_code`). Se o cliente aplicou um cupom no carrinho, o valor é ignorado no checkout Yampi.
- **Impacto**: Clientes pagam valor cheio na Yampi mesmo quando aplicaram cupom válido no site.
- **Fix**: Incluir `discount` ou `coupon_code` no payload do payment link, se a API Yampi suportar. Caso contrário, documentar limitação e considerar recalcular preços dos SKUs com desconto embutido.

**Y34. yampi-catalog-sync: Não sincroniza slug de categorias pai → filho pode falhar**
- `yampi-catalog-sync/index.ts` — O sync de categorias é feito por nome, mas se a categoria pai não existir na Yampi, o produto é criado sem categoria ou com categoria errada. Não há validação prévia.
- **Impacto**: Produtos podem ficar sem categoria na Yampi, dificultando navegação no marketplace.
- **Fix**: Na criação de produto, validar que `yampiCategoryId` é válido; se não for, logar warning e criar sem categoria em vez de falhar silenciosamente.

**Y35. yampi-webhook: Eventos de atualização de produto/SKU não são processados**
- `yampi-webhook/index.ts` — O webhook processa apenas eventos de payment (approved, cancelled, shipped, delivered). Se a Yampi enviar webhooks de alteração de produto/preço/estoque, eles são ignorados silenciosamente.
- **Impacto**: Alterações feitas na Yampi não são refletidas no site (estoque, preço). O site é fonte de verdade, mas não há sync bidirecional.
- **Fix (opcional)**: Documentar que o fluxo é unidirecional (site → Yampi). Ou implementar handlers para `product.updated`, `sku.updated` se sync bidirecional for necessário.

### MEDIO

**Y36. yampi-import-order: Não importa dados de rastreio do pedido**
- `yampi-import-order/index.ts` linhas 225-280 — A função batch `importSingleOrder` não extrai `tracking_code` do pedido Yampi. Apenas a função principal (linhas 175-180) processa o tracking.
- **Impacto**: Pedidos importados em batch ficam sem código de rastreio mesmo que já tenham sido enviados na Yampi.
- **Fix**: Adicionar extração de `tracking_code` na função batch.

**Y37. checkout-create-session: Fallback silencioso pode confundir usuário**
- `checkout-create-session/index.ts` linhas 232-236 e 360-362 — Quando SKUs não estão vinculados à Yampi ou ocorre erro, o sistema faz fallback para `/checkout` nativo. Mas o usuário não recebe feedback claro de que o checkout externo falhou.
- **Impacto**: UX confusa. Usuário pode não entender por que foi redirecionado para checkout diferente.
- **Fix**: Retornar flag `fallback_reason` para que o frontend possa exibir toast/mensagem explicativa.

**Y38. yampi-catalog-sync: Não sincroniza campos de dimensão (peso/altura/largura) do produto pai quando variante não tem valores**
- `yampi-catalog-sync/index.ts` linhas 354-357 e 394-399 — Os campos `weight`, `height`, `width`, `length` usam valores fixos como fallback (0.3, 5, 15, 20) em vez de buscar do produto pai se a variante não tiver esses dados.
- **Impacto**: SKUs na Yampi podem ter dimensões incorretas, afetando cálculo de frete.
- **Fix**: Priorizar valores da variante, depois do produto, depois defaults.

**Y39. yampi-sync-images: Não limpa imagens antigas antes de enviar novas**
- `yampi-sync-images/index.ts` linhas 348-354 — O sync apenas adiciona imagens via POST. Se o produto tinha imagens na Yampi que foram removidas no site, elas permanecem na Yampi.
- **Impacto**: Imagens desatualizadas podem permanecer na Yampi após remoção no site.
- **Fix (opcional)**: Adicionar flag `replace_existing` que deleta imagens anteriores antes de enviar novas.

### BAIXO

**Y40. yampi-webhook: Campo `external_reference` pode colidir entre Yampi e Appmax**
- `yampi-webhook/index.ts` linhas 92, 148 — O campo `external_reference` é usado para armazenar o `yampiOrderId`. Porém, o mesmo campo é usado pelo fluxo Appmax.
- **Impacto**: Se um cliente usar ambos os gateways, pode haver confusão na rastreabilidade.
- **Fix (futuro)**: Considerar campos separados `yampi_order_id` e `appmax_order_id` na tabela `orders`.

**Y41. checkout-create-session: Log de fallback vai para tabela `integrations_checkout_test_logs` que pode não existir em todos os projetos**
- **Impacto**: Se a tabela não existir, o log falha silenciosamente. Sem impacto funcional.
- **Fix**: Verificar existência da tabela ou usar `error_logs` como fallback.

---

## Fluxo de Comunicação Atual (Resumo)

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         SITE → YAMPI (Push)                          │
├─────────────────────────────────────────────────────────────────────┤
│ yampi-catalog-sync     → Cria/atualiza produtos, SKUs, categorias   │
│ yampi-sync-sku         → Atualiza preço/estoque de variantes        │
│ yampi-sync-images      → Envia imagens convertidas para SKUs        │
│ checkout-create-session → Cria payment link + fast sync preço/qty   │
│ yampi-sync-order-status → Atualiza status pedido site → Yampi       │
├─────────────────────────────────────────────────────────────────────┤
│                         YAMPI → SITE (Pull/Webhook)                  │
├─────────────────────────────────────────────────────────────────────┤
│ yampi-webhook          → Recebe eventos pagamento/envio/entrega     │
│ yampi-import-order     → Importa pedidos manuais por ID             │
│ yampi-sync-categories  → Cria categorias na Yampi (não importa)     │
└─────────────────────────────────────────────────────────────────────┘
```

**Gaps identificados:**
- Nenhum sync bidirecional de produtos (alterações na Yampi não voltam ao site)
- Cupons/descontos não são enviados ao payment link
- Tracking não importado em batch

---

## Plano de Implementação

### Fase 1 — Bugs de Comunicação (Risco: BAIXO)
1. **Y31**: yampi-sync-images — substituir `fetch` por `fetchWithTimeout`
2. **Y36**: yampi-import-order batch — adicionar extração de `tracking_code`

### Fase 2 — Melhorias de Integridade (Risco: BAIXO)
3. **Y32**: yampi-sync-images — validar URL acessível após upload
4. **Y38**: yampi-catalog-sync — herdar dimensões do produto pai se variante não tiver

### Fase 3 — UX e Documentação (Risco: ZERO)
5. **Y37**: checkout-create-session — retornar `fallback_reason` para frontend
6. **Y33**: Documentar limitação de cupons com Yampi OU implementar desconto embutido nos preços

### Não Implementar Agora
- **Y35**: Sync bidirecional de produtos requer redesign significativo
- **Y39**: Limpeza de imagens antigas pode causar inconsistências
- **Y40**: Separação de campos requer migration e pode afetar queries

