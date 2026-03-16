# Guia de Integrações

Padrões e boas práticas para integrar serviços externos nas Edge Functions.

---

## Princípios

1. **Credenciais sempre via Supabase Secrets** – nunca hard-coded no código.
2. **Client dedicado por serviço** – cada integração tem suas funções helpers.
3. **Timeout em todas as chamadas externas** – usar `fetchWithTimeout`.
4. **Tratamento de erro específico** – identificar erros do provider vs. erros de rede.
5. **Logging com contexto** – sempre incluir `provider` e `correlationId` nos logs.
6. **Idempotência** – operações de escrita devem ser seguras para retry.

---

## Padrão de client de integração

Cada integração externa deve ter seu próprio módulo helper:

```typescript
// supabase/functions/_shared/stripeClient.ts
import Stripe from "https://esm.sh/stripe@...";

export function createStripeClient(): Stripe {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY não configurada");
  return new Stripe(secretKey, { apiVersion: "2024-11-20.acacia" });
}
```

```typescript
// Uso em uma Edge Function
import { createStripeClient } from "../_shared/stripeClient.ts";

const stripe = createStripeClient();
const intent = await stripe.paymentIntents.create({ ... });
```

---

## Padrão de chamada HTTP externa

```typescript
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";

async function chamarAPIExterna(url: string, body: object, token: string) {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }, 10_000); // timeout 10s

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`[NomeProvider] Erro ${response.status}: ${errorBody}`);
  }

  return response.json();
}
```

---

## Validação de webhooks

### Stripe
```typescript
const event = await stripe.webhooks.constructEventAsync(
  rawBody,
  signature,
  Deno.env.get("STRIPE_WEBHOOK_SECRET")!
);
```

### Yampi
```typescript
// Validar token na query string
const url = new URL(req.url);
const token = url.searchParams.get("token");
if (token !== Deno.env.get("YAMPI_WEBHOOK_TOKEN")) {
  return new Response("Unauthorized", { status: 401 });
}
```

### Appmax
```typescript
// Validar hash do evento
import { validateAppmaxWebhook } from "../_shared/appmax.ts";
if (!validateAppmaxWebhook(body, Deno.env.get("APPMAX_WEBHOOK_SECRET")!)) {
  return new Response("Unauthorized", { status: 401 });
}
```

---

## Tratamento de erros por provider

| Situação | Como tratar |
|----------|------------|
| Timeout (sem resposta) | Capturar AbortError, logar, retornar erro com hint de retry |
| Rate limit (429) | Logar, aguardar e fazer retry (máx. 3x) |
| Credenciais inválidas (401/403) | Logar, não fazer retry, alertar admin |
| Servidor do provider down (5xx) | Logar, não fazer retry imediato, considerar fila |
| Resposta malformada | Logar com payload recebido, lançar erro específico |

---

## Variáveis de ambiente por integração

| Integração | Variável | Onde configurar |
|-----------|---------|----------------|
| Stripe | `STRIPE_SECRET_KEY` | Supabase Secrets |
| Stripe | `STRIPE_WEBHOOK_SECRET` | Supabase Secrets |
| Yampi | `YAMPI_TOKEN` | Supabase Secrets / tabela de integrações |
| Yampi | `YAMPI_ALIAS` | Supabase Secrets / tabela de integrações |
| Appmax | `APPMAX_API_KEY` | Supabase Secrets / tabela de integrações |
| Bling | `BLING_CLIENT_ID` | Supabase Secrets |
| Bling | `BLING_CLIENT_SECRET` | Supabase Secrets |
| CORS | `CORS_ALLOWED_ORIGINS` | Supabase Secrets (opcional) |

**Preferência:** credenciais por tenant devem ficar na tabela `integrations_checkout_providers` (banco), não em Supabase Secrets, para facilitar multi-tenant no futuro.

---

## Adicionando uma nova integração

1. Criar helper em `supabase/functions/_shared/nomeIntegration.ts`.
2. Criar as Edge Functions necessárias seguindo [`EDGE_FUNCTIONS_GUIDE.md`](EDGE_FUNCTIONS_GUIDE.md).
3. Adicionar as credenciais via Supabase Secrets.
4. Adicionar a integração em [`API_INVENTORY.md`](API_INVENTORY.md).
5. Atualizar `.env.example` se houver variáveis de frontend necessárias.
6. Documentar o fluxo em [`CHECKOUT_FLOW.md`](CHECKOUT_FLOW.md) se for provedor de pagamento.
