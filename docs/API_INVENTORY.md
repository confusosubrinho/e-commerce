# Inventário de APIs e Integrações

Catálogo completo de todas as integrações externas e endpoints internos da plataforma.

---

## Integrações externas

### Stripe
| Campo | Valor |
|-------|-------|
| **URL base** | `https://api.stripe.com/v1` |
| **Autenticação** | Bearer token (`STRIPE_SECRET_KEY`) |
| **Docs** | https://stripe.com/docs/api |
| **Finalidade** | Processamento de pagamentos (cartão, PIX via Stripe) |

**Endpoints usados:**
| Endpoint | Finalidade |
|----------|-----------|
| `POST /payment_intents` | Criar PaymentIntent para checkout transparente |
| `POST /checkout/sessions` | Criar sessão de checkout externo |
| `GET /payment_intents/:id` | Verificar status de pagamento |
| `GET /checkout/sessions/:id` | Verificar status de sessão |
| Webhook: `payment_intent.succeeded` | Pagamento confirmado |
| Webhook: `checkout.session.completed` | Sessão de checkout concluída |

**Edge Functions relacionadas:**
- `checkout-stripe-create-intent`
- `checkout-stripe-webhook`
- `checkout-stripe-catalog-sync`
- `checkout-reprocess-stripe-webhook`
- `checkout-reconcile-order`

---

### Yampi
| Campo | Valor |
|-------|-------|
| **URL base** | `https://api.yampi.io/v2/{alias}` |
| **Autenticação** | Header `User-Token: {YAMPI_TOKEN}` |
| **Docs** | https://docs.yampi.io |
| **Finalidade** | Checkout externo, catálogo de produtos, gestão de pedidos |

**Endpoints usados:**
| Endpoint | Finalidade |
|----------|-----------|
| `POST /checkout` | Criar link de checkout |
| `GET /orders` | Listar pedidos |
| `GET /orders/:id` | Buscar pedido por ID |
| `GET /skus` | Listar SKUs do catálogo |
| `GET /variations` | Listar variações |
| `GET /categories` | Listar categorias |
| Webhook: `payment.approved` | Pagamento aprovado |
| Webhook: `order.updated` | Status do pedido atualizado |

**Edge Functions relacionadas:**
- `yampi-webhook`
- `yampi-import-order`
- `yampi-sync-order-status`
- `yampi-catalog-sync`
- `yampi-sync-sku`
- `yampi-sync-variation-values`
- `yampi-sync-images`
- `yampi-sync-categories`

---

### Appmax
| Campo | Valor |
|-------|-------|
| **URL base** | `https://api.appmax.com.br` (via helpers `_shared/appmax.ts`) |
| **Autenticação** | API Key (`APPMAX_API_KEY`) |
| **Finalidade** | Pagamento transparente |

**Edge Functions relacionadas:**
- `appmax-webhook`
- `appmax-authorize`
- `appmax-get-app-token`
- `appmax-generate-merchant-keys`
- `appmax-healthcheck`
- `appmax-healthcheck-ping`
- `checkout-process-payment` (ao usar Appmax)

---

### Bling (ERP)
| Campo | Valor |
|-------|-------|
| **URL base** | `https://www.bling.com.br/Api/v3` |
| **Autenticação** | OAuth 2.0 (`BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`) |
| **Docs** | https://developer.bling.com.br |
| **Finalidade** | Sincronização de estoque e pedidos com ERP |

**Edge Functions relacionadas:**
- `bling-webhook`
- `bling-oauth`
- `bling-sync`
- `bling-sync-single-stock`

---

## Edge Functions internas

Endpoints expostos pelas Edge Functions para uso interno (admin + frontend):

| Endpoint | Método | Auth | Finalidade |
|----------|--------|------|-----------|
| `checkout-create-session` | POST | Público (CORS) | Iniciar sessão de checkout |
| `checkout-calculate-shipping` | POST | Público | Calcular opções de frete |
| `checkout-process-payment` | POST | Público | Processar pagamento (Appmax) |
| `checkout-stripe-create-intent` | POST | Público | Criar PaymentIntent Stripe |
| `checkout-update-settings` | POST | Admin | Atualizar configurações de checkout |
| `checkout-reconcile-order` | POST | Admin | Reconciliar pedido com gateway |
| `checkout-reprocess-stripe-webhook` | POST | Admin | Reprocessar webhook Stripe com erro |
| `checkout-release-expired-reservations` | POST | Cron/Admin | Liberar reservas expiradas |
| `checkout-stripe-catalog-sync` | POST | Admin | Sincronizar catálogo com Stripe |
| `checkout-stripe-webhook` | POST | Stripe (assinatura) | Receber webhooks Stripe |
| `yampi-webhook` | POST | Yampi (token) | Receber webhooks Yampi |
| `yampi-import-order` | POST | Admin | Importar pedido Yampi manualmente |
| `yampi-sync-order-status` | POST | Admin | Sincronizar status de pedido com Yampi |
| `yampi-catalog-sync` | POST | Admin | Sincronizar catálogo com Yampi |
| `yampi-sync-sku` | POST | Admin | Sincronizar SKUs Yampi |
| `yampi-sync-images` | POST | Admin | Sincronizar imagens Yampi |
| `yampi-sync-variation-values` | POST | Admin | Sincronizar variações Yampi |
| `yampi-sync-categories` | POST | Admin | Sincronizar categorias Yampi |
| `appmax-webhook` | POST | Appmax (hash) | Receber webhooks Appmax |
| `appmax-authorize` | POST | Admin | Autorizar Appmax |
| `appmax-healthcheck` | GET | Admin | Verificar saúde Appmax |
| `bling-webhook` | POST | Bling | Receber webhooks Bling |
| `bling-oauth` | GET/POST | Admin | Fluxo OAuth Bling |
| `bling-sync` | POST | Admin/Cron | Sincronizar estoque Bling |
| `bling-sync-single-stock` | POST | Admin | Sincronizar estoque de um SKU |
| `seo-generate` | POST | Admin | Gerar SEO para produto |
| `seo-robots` | GET | Público | Servir robots.txt |
| `seo-sitemap` | GET | Público | Servir sitemap.xml |
| `admin-commerce-action` | POST | Admin | Ações administrativas gerais |
| `admin-repair-images` | POST | Admin | Reparar imagens de produtos |
| `integrations-test` | POST | Admin | Testar conexão de integração |
| `integrations-tray-import` | POST | Admin | Importar produtos do Tray |
| `cron-cleanup-logs` | POST | Cron | Limpar logs antigos |

---

## Monitoramento de saúde das integrações

Para verificar se uma integração está funcionando:
- **Admin:** `/admin/commerce-health` – visão de webhooks com erro.
- **Teste de conexão:** `/admin/integrations` → botão "Testar conexão".
- **Logs:** Supabase Dashboard → Edge Functions → Logs.

Veja também [`OBSERVABILITY.md`](OBSERVABILITY.md).
