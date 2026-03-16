# Observabilidade e Monitoramento

Estratégia de logs, métricas e alertas da plataforma.

---

## Logs

### Padrão de log em Edge Functions

Todo log de erro ou evento relevante deve incluir:

```typescript
console.error('[FunctionName]', {
  correlation_id: crypto.randomUUID(),
  order_id: order?.id,
  provider: 'stripe' | 'yampi' | 'appmax',
  external_reference: order?.external_reference,
  error: error.message,
  // Nunca logar: customer_email, customer_phone, shipping_address, dados de cartão
});
```

Campos obrigatórios em logs de erro:
- `correlation_id` – para rastrear a requisição end-to-end
- Contexto do objeto principal (ex.: `order_id`, `product_id`)
- `provider` quando for log de integração
- `error` com mensagem descritiva

### Onde ficam os logs
- **Edge Functions:** logs disponíveis no painel Supabase → Edge Functions → Logs.
- **Webhooks Stripe:** tabela `stripe_webhook_events` (com `error_message`).
- **Erros de checkout:** logs das Edge Functions de checkout.

---

## Métricas a monitorar

### Fluxo de checkout (crítico)
| Métrica | Onde coletar | Alerta sugerido |
|---------|-------------|----------------|
| Taxa de erro de checkout por provider | Logs de `checkout-create-session` | > 5% em 1h |
| Pedidos criados vs. pagos | Tabela `orders` | Diferença > 20% em 1h |
| Tempo médio de `checkout-create-session` | Logs de Edge Function | p95 > 5s |

### Webhooks e integrações
| Métrica | Onde coletar | Alerta sugerido |
|---------|-------------|----------------|
| Webhooks Stripe com erro | `stripe_webhook_events.error_message` | Qualquer erro novo |
| Falhas de webhook Yampi/Appmax | Logs das Edge Functions | > 3 erros em 15min |
| Última vez que webhook foi recebido | Tabela de logs por provider | Ausência > 24h (se loja ativa) |

### Estoque
| Métrica | Onde coletar | Alerta sugerido |
|---------|-------------|----------------|
| Produtos com estoque zerado | `product_variants.stock <= 0` | – (relatório diário) |
| Divergência de estoque (Bling vs. local) | Comparar sync Bling | – (relatório após sync) |

---

## Onde visualizar no admin

- **CommerceHealth (`/admin/commerce-health`):** webhooks Stripe com erro, status de integrações.
- **SystemAndLogs (`/admin/system`):** logs do sistema.
- **Dashboard (`/admin/dashboard`):** visão geral de vendas.
- **Super Admin (futuro):** visão consolidada de métricas e saúde da plataforma.

---

## Rastreio de um pedido ponta-a-ponta

Para rastrear um pedido do frontend ao banco:

1. **Frontend:** `cart_id` (localStorage) → `idempotency_key` do pedido.
2. **DB:** `orders.idempotency_key = cart_id` → encontrar o pedido.
3. **Edge Function:** buscar nos logs da function de checkout pelo `order_id` ou `correlation_id`.
4. **Gateway:** `orders.external_reference` = ID do Stripe/Yampi → buscar no painel do gateway.
5. **Webhook:** `stripe_webhook_events.event_id` ou logs de Yampi/Appmax.

---

## Retenção de logs

| Tipo de log | Retenção | Observação |
|-------------|---------|------------|
| `stripe_webhook_events` com erro | 1 ano | Manter para auditoria |
| `stripe_webhook_events` com sucesso | 180 dias | – |
| Logs de Edge Functions (Supabase) | 7 dias (padrão Supabase) | Exportar se necessário |
| Logs de webhook Yampi/Appmax | 90 dias | – |

Limpeza de logs implementada via cron function (`cron-cleanup-logs`).
