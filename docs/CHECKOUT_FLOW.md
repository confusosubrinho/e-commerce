# Fluxos de Checkout

Documentação de todos os fluxos de checkout disponíveis na plataforma.

---

## Providers disponíveis

| Provider | Modo | Onde o pedido é criado |
|----------|------|----------------------|
| Stripe | Embutido (embedded) | Frontend, antes do pagamento |
| Stripe | Externo (redirect) | Frontend, antes do redirect |
| Stripe | Transparente | Frontend, antes de chamar stripe-create-intent |
| Yampi | Externo (redirect) | Webhook `payment.approved` da Yampi |
| Appmax | Transparente | Frontend, antes de chamar process-payment |

---

## Fluxo 1: Stripe Embutido (Embedded)

```
Cliente clica "Comprar"
       │
       ▼
CheckoutStart.tsx
  └─► checkout-create-session (resolve provider)
       │  retorna: flow="stripe_embedded"
       ▼
Checkout.tsx
  ├─► Cria pedido no DB (cart_id + idempotency_key)
  ├─► checkout-stripe-create-intent
  │     └─► stripe.paymentIntents.create()
  │         retorna: client_secret
  ▼
StripePaymentForm
  ├─► Cliente preenche dados do cartão
  ├─► stripe.confirmPayment()
  └─► Redireciona para /checkout/obrigado
       │
       ▼
Webhook: stripe-webhook
  └─► payment_intent.succeeded → atualiza orders.status = 'paid'
```

---

## Fluxo 2: Stripe Externo (Redirect)

```
Cliente clica "Comprar"
       │
       ▼
CheckoutStart.tsx
  ├─► checkout-create-session (resolve provider)
  │     retorna: flow="stripe_external"
  ├─► Cria pedido no DB
  ├─► checkout-stripe-create-intent (create_checkout_session=true)
  │     └─► stripe.checkout.sessions.create()
  │         retorna: checkout_url
  └─► Redirect para Stripe Checkout
       │
       ▼ (retorno do Stripe)
CheckoutReturn.tsx (/checkout/obrigado?session_id=...)
  ├─► Busca pedido por external_reference = session_id
  ├─► Polling 10×3s aguardando status atualizar
  └─► Exibe confirmação

Webhook: stripe-webhook
  └─► checkout.session.completed → atualiza orders.status + external_reference
```

---

## Fluxo 3: Yampi Externo (Redirect)

```
Cliente clica "Comprar"
       │
       ▼
CheckoutStart.tsx
  └─► checkout-create-session (items + success_url + cancel_url)
       ├─► Valida que todos os itens têm yampi_sku_id
       ├─► Cria link de pagamento na API Yampi
       └─► Retorna: checkout_url (link Yampi)
       │
       ▼
Redirect para Yampi Checkout
       │
       ▼ (pagamento aprovado na Yampi)
Webhook: yampi-webhook
  ├─► Evento: payment.approved
  ├─► Cria pedido no DB (orders + order_items)
  ├─► Debita estoque (inventory_movements)
  └─► Armazena: external_reference, yampi_order_number, variantes, SKUs

Importação manual admin:
  └─► yampi-import-order
       ├─► Busca pedido na API Yampi
       ├─► Cria/atualiza pedido no DB
       └─► Debita estoque se não debitado
```

---

## Fluxo 4: Appmax Transparente

```
Checkout.tsx
  ├─► Cria pedido no DB
  ├─► checkout-process-payment (provider: appmax)
  │     ├─► Valida credenciais Appmax
  │     ├─► Chama API Appmax (cobrar)
  │     └─► Retorna: status, transaction_id
  └─► Exibe resultado ao cliente

Webhook: appmax-webhook
  ├─► Eventos com precedência (não regride status)
  └─► Atualiza orders.status + payments
```

---

## Idempotência e segurança

- **Pedido único por carrinho:** `orders` tem constraint UNIQUE em `idempotency_key` (derivado de `cart_id`). Duplo clique ou retry não cria dois pedidos.
- **Stripe Idempotency-Key:** criação de PaymentIntent e Session usa Idempotency-Key para evitar dupla cobrança em retry.
- **Webhooks idempotentes:**
  - Stripe: `stripe_webhook_events.event_id` UNIQUE.
  - Yampi: `external_reference` + flag `duplicate`.
  - Appmax: `event_hash` UNIQUE.
- **Status não regride:** nenhum webhook volta pedido de `paid` para `pending`.

---

## Reconciliação e retry

- **Conciliar com Stripe:** admin pode acionar `checkout-reconcile-order` para forçar verificação do status no Stripe e atualizar o pedido.
- **Reprocessar webhook Stripe:** admin pode reprocessar eventos Stripe com erro via `checkout-reprocess-stripe-webhook`.
- **Sync status Yampi:** admin pode acionar `yampi-sync-order-status` para verificar o status do pedido na API Yampi.

---

## Configuração do provider ativo

A configuração do provider ativo é lida via view `checkout_settings` (Supabase), que unifica `integrations_checkout` e `integrations_checkout_providers`. O admin pode alternar entre Stripe e Yampi em `/admin/checkout-transparente`.
