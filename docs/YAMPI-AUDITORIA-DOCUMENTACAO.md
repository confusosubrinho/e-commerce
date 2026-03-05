# Auditoria: Integração Yampi vs Documentação Oficial

Comparação entre a [documentação da Yampi](https://docs.yampi.com.br/api-reference/introduction) e a implementação no site.

---

## 1. API Base e Autenticação

| Documentação Yampi | Implementação no site | Status |
|--------------------|------------------------|--------|
| Base: `https://api.dooki.com.br/v2/{alias}` | `yampiBase = https://api.dooki.com.br/v2/${alias}` em todas as Edge Functions | ✅ |
| Headers: `User-Token`, `User-Secret-Key`, `Content-Type: application/json` | Usado em checkout-create-session, yampi-catalog-sync, yampi-sync-sku, yampi-sync-categories, yampi-sync-variation-values, yampi-sync-images, yampi-import-order | ✅ |
| Alias, token e chave vêm do config do provider (integrations_checkout_providers) | Config salvo no admin (Checkout → Yampi → Configurar): alias, user_token, user_secret_key | ✅ |

---

## 2. Link de Pagamento (Checkout redirect)

| Documentação Yampi | Implementação no site | Status |
|--------------------|------------------------|--------|
| `POST /{alias}/checkout/payment-link` | `checkout-create-session`: chama `${yampiBase}/checkout/payment-link` | ✅ |
| Body: `name`, `active`, `skus` (array de `{ id, quantity }`) | Envia `name`, `active`, `skus` (id = yampi_sku_id da variante), mais `metadata.session_id` | ✅ |
| Resposta: link de pagamento (ex.: `link_url`) | Trata `link_url` em `data` ou no top level; fallback para `payments/links` se 404 | ✅ |
| SKUs devem existir na Yampi | Validação: todos os itens precisam de `yampi_sku_id`; senão retorna erro ou fallback para checkout nativo | ✅ |
| Opcional: sync de preço/estoque antes | Se `sync_enabled`: PUT em `/catalog/skus/{id}` com price_sale, quantity antes de criar o link | ✅ |

**Observação:** success_url e cancel_url estão no formulário de configuração Yampi mas a API de payment-link da documentação não mostra esses campos no create. O redirect após pagamento é controlado pela Yampi no painel ou no link. Se a Yampi aceitar esses parâmetros em outro endpoint, vale conferir no painel.

---

## 3. Catálogo (Produtos e SKUs)

| Documentação Yampi | Implementação no site | Status |
|--------------------|------------------------|--------|
| `POST /{alias}/catalog/products` | yampi-catalog-sync: cria produto com name, slug, active, brand_id, category_id, variations_ids, skus (produto simples) | ✅ |
| `POST /{alias}/catalog/skus` | yampi-catalog-sync: cria SKU com product_id, sku, price_cost, price_sale, variations_values_ids, etc. | ✅ |
| `PUT /{alias}/catalog/skus/{id}` para atualizar | yampi-catalog-sync e checkout-create-session: PUT com product_id, price_sale, quantity (doc exige product_id no PUT) | ✅ |
| Categorias | yampi-sync-categories: sincroniza categorias; catalog-sync usa categories_ids / category_id quando há mapeamento | ✅ |
| Variações (tamanho, cor) | yampi-sync-variation-values + variation_value_map no DB; catalog-sync envia variations_values_ids nos SKUs | ✅ |
| Imagens | yampi-sync-images: envia imagens dos produtos para os SKUs na Yampi (fluxo separado do catalog-sync) | ✅ |

---

## 4. Webhooks

| Documentação Yampi | Implementação no site | Status |
|--------------------|------------------------|--------|
| Eventos: order.created, order.paid, order.status.updated, etc. | yampi-webhook: trata order.paid, payment.approved, order.status.updated (normaliza para paid/cancelled), order.cancelled, shipped, delivered | ✅ |
| Validação oficial: header `X-Yampi-Hmac-SHA256` = base64(HMAC-SHA256(body, secret)) | **Implementação atual:** validação por `?token=` na URL (query) com o mesmo valor do webhook_secret configurado no admin | ⚠️ Alternativo |
| Resposta 200/201 em até 5 segundos | Respostas com status 200 e body JSON | ✅ |

**Recomendação:** A documentação recomenda validar com HMAC-SHA256 e o header `X-Yampi-Hmac-SHA256`. No seu site a validação é por token na query, o que funciona desde que a URL seja secreta e só a Yampi a use. Para alinhar 100% à doc, seria possível adicionar validação HMAC além do token (ou em vez dele), usando o mesmo secret.

---

## 5. Fluxo no site (front + backend)

| Etapa | Onde está | Status |
|-------|-----------|--------|
| Configurar Yampi (alias, token, secret, webhook_secret, success_url, cancel_url, etc.) | Admin → Checkout → Yampi → Configurar | ✅ |
| Ativar gateway Yampi | Admin → Gateways → Yampi ativo | ✅ |
| Resolve (flow = gateway, provider = yampi) | checkout_settings / integrations_checkout + providers; checkout-create-session action "resolve" e checkout-router route "resolve" | ✅ |
| Carrinho → Finalizar compra | CheckoutStart → checkout-router (start) → se Yampi: checkout-create-session com items → cria payment link → redirect | ✅ |
| Redirect para Yampi | redirect_url retornado pelo payment-link; usuário paga na Yampi | ✅ |
| Webhook recebido | Edge Function **yampi-webhook** (URL: `.../functions/v1/yampi-webhook?token=...`) | ✅ |
| Atualizar pedido existente por session_id | yampi-webhook: busca order por checkout_session_id (metadata.session_id); atualiza e debita estoque | ✅ |
| Criar pedido novo se não achar por session | yampi-webhook: cria order, itens, payment, cliente, log de email | ✅ |
| Cancelamento / recusa | yampi-webhook: cancelled/refused → status cancelled e estorna estoque | ✅ |
| Envio / entrega | yampi-webhook: shipped → status shipped + tracking_code; delivered → status delivered | ✅ |

---

## 6. Importar pedido da Yampi manualmente

| Documentação Yampi | Implementação no site | Status |
|--------------------|------------------------|--------|
| Buscar pedido por ID/número | yampi-import-order: usa `config.alias` (corrigido de store_alias), User-Token, User-Secret-Key; GET em `/orders?include=...&q=...` | ✅ |
| Só admin | Verificação de role admin via user_roles | ✅ |
| Evitar duplicar | Checagem por external_reference antes de criar | ✅ |

---

## 7. Ajustes feitos nesta auditoria

1. **URL do webhook no admin:** A URL exibida para cadastrar na Yampi estava `.../yampi/webhook`. Com funções no formato flat, o correto é `.../yampi-webhook`. Ajustado em `CheckoutSettings.tsx`.
2. **yampi-import-order:** Lia `config.store_alias`; o formulário salva `config.alias`. Corrigido para `config.alias` para bater com o restante do projeto.

---

## 8. Checklist rápido para funcionar

- [ ] **Credenciais:** Admin → Checkout → Yampi → Configurar: alias, User Token, User Secret Key preenchidos e salvos.
- [ ] **Webhook na Yampi:** Cadastrar URL `https://SEU_PROJECT_REF.supabase.co/functions/v1/yampi-webhook?token=SUA_CHAVE` (a mesma chave em "Chave secreta do webhook" no Configurar).
- [ ] **Catálogo:** Rodar Categorias, Variações, depois Catálogo (e Imagens se quiser). Garantir que produtos/variantes tenham yampi_product_id e yampi_sku_id.
- [ ] **Gateway ativo:** Yampi ativado em Gateways de pagamento.
- [ ] **Deploy das funções:** checkout-router, checkout-create-session, yampi-webhook, yampi-catalog-sync, yampi-sync-sku, yampi-sync-categories, yampi-sync-variation-values, yampi-sync-images, yampi-import-order (e demais que o projeto usar).

Se algo não bater com a documentação atual da Yampi (novos campos ou endpoints), vale atualizar este doc e o código conforme a [documentação oficial](https://docs.yampi.com.br/api-reference/).
