

# Auditoria Yampi — Rodada 5: Timeouts Restantes e Integridade

---

## Problemas Encontrados

### CRITICO

**Y42. yampi-sync-sku: Loop de variantes usa `fetch` direto sem timeout (linha 104)**
O endpoint sincroniza variantes individuais com `fetchWithTimeout` (linha 63), mas o loop que sincroniza todas as variantes de um produto usa `fetch` direto (linha 104). Se a API travar em uma das variantes, toda a sincronização fica bloqueada.
- **Impacto**: Sincronização de produtos com múltiplas variantes pode travar indefinidamente.
- **Fix**: Substituir `fetch` por `fetchWithTimeout` no loop de variantes.

**Y43. yampi-sync-variation-values: Não usa fetchWithTimeout (linha 19)**
A função `yampiRequest` interna usa `fetch` direto sem timeout. Como esta função é chamada repetidamente para criar/mapear valores de variação, uma travada na API bloqueia o processo inteiro.
- **Impacto**: Sincronização de valores de variação (tamanhos, cores) pode travar.
- **Fix**: Importar e usar `fetchWithTimeout` na função `yampiRequest`.

**Y44. yampi-import-order batch: Usa fetch direto sem timeout (linha 481)**
A função `importSingleOrder` faz chamada à API Yampi para buscar o pedido usando `fetch` sem timeout.
- **Impacto**: Importação em batch pode travar em um pedido e não processar os demais.
- **Fix**: Substituir por `fetchWithTimeout`.

### ALTO

**Y45. integrations-test: Não usa fetchWithTimeout (linha 43)**
O teste de conexão com Yampi usa `fetch` direto. Se a API Yampi estiver lenta, o admin fica esperando indefinidamente.
- **Impacto**: UX ruim ao testar conexão.
- **Fix**: Usar `fetchWithTimeout` com timeout de 15s.

**Y46. checkout-router: Stripe external não reserva estoque atomicamente**
O `checkout-router` reserva estoque atomicamente para Yampi external (linhas 321-336), mas não faz o mesmo para Stripe external (linhas 384-430). Isso cria risco de overselling quando Stripe external está habilitado.
- **Impacto**: Clientes podem comprar produtos sem estoque via Stripe Checkout.
- **Fix**: Adicionar reserva atômica de estoque para Stripe external no router.

### MEDIO

**Y47. yampi-sync-sku: Não valida se produto está ativo antes de sincronizar**
O endpoint sincroniza variantes mesmo de produtos inativos, potencialmente enviando dados desnecessários ou incorretos para a Yampi.
- **Fix**: Adicionar filtro `.eq("products.is_active", true)` na query de variantes.

**Y48. yampi-import-order batch: Não incrementa coupon uses_count**
Quando um pedido importado tinha cupom aplicado (`coupon_code`), o contador de uso do cupom não é incrementado, causando divergência nos relatórios de uso de cupons.
- **Fix**: Após inserir pedido com cupom, chamar `increment_coupon_uses` RPC.

**Y49. yampi-catalog-sync e yampi-sync-categories: Não sincronizam descrição/meta de categoria**
Apenas `name` e `slug` são enviados para a Yampi. A `description` da categoria (se existir localmente) não é propagada.
- **Fix**: Adicionar campo `description` ao payload de criação de categoria.

### BAIXO

**Y50. yampi-sync-variation-values: Rate limit hardcoded pode ser insuficiente**
Os delays entre chamadas (500-800ms) são hardcoded. Se a Yampi estiver mais restritiva, podem ocorrer 429.
- **Fix (futuro)**: Implementar retry com backoff exponencial em caso de 429.

---

## Plano de Implementação

### Fase 1 — Timeouts Críticos (Risco: BAIXO)
1. **Y42**: yampi-sync-sku — substituir `fetch` por `fetchWithTimeout` no loop
2. **Y43**: yampi-sync-variation-values — usar `fetchWithTimeout` em `yampiRequest`
3. **Y44**: yampi-import-order batch — usar `fetchWithTimeout`
4. **Y45**: integrations-test — usar `fetchWithTimeout`

### Fase 2 — Integridade de Estoque (Risco: MÉDIO)
5. **Y46**: checkout-router — adicionar reserva atômica de estoque para Stripe external

### Fase 3 — Melhorias de Dados (Risco: ZERO)
6. **Y47**: yampi-sync-sku — filtrar apenas produtos ativos
7. **Y48**: yampi-import-order batch — incrementar `uses_count` do cupom

---

## Resumo das 5 Rodadas de Auditoria

| Rodada | Foco | Fixes |
|--------|------|-------|
| 1 | Preços, CORS, timeouts básicos | Y1-Y10 |
| 2 | Webhooks, automações, idempotência | Y11-Y21 |
| 3 | Race conditions, auditoria estoque | Y22-Y30 |
| 4 | Comunicação, validação URLs, dimensões | Y31-Y41 |
| 5 | Timeouts restantes, estoque Stripe | Y42-Y50 |

**Total acumulado**: 50 melhorias identificadas

