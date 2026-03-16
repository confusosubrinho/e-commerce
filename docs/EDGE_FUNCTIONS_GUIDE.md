# Guia de Edge Functions

Padrão de desenvolvimento para todas as Supabase Edge Functions do projeto.

> Runtime: **TypeScript/Deno** (não Node.js). Usar `import/export` ESM, nunca `require()`.

---

## Estrutura padrão de uma Edge Function

```typescript
// supabase/functions/nome-da-funcao/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";
import { logError, logInfo } from "../_shared/log.ts";

const SCOPE = "nome-da-funcao";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  const correlationId = req.headers.get("x-request-id") || crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return errorResponse("Unauthorized", 401, corsHeaders);
    }

    const body = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const result = await processarAlgo(supabase, body, correlationId);
    return successResponse(result, corsHeaders);
  } catch (error) {
    logError(SCOPE, correlationId, error);
    return errorResponse(
      error instanceof Error ? error.message : "Erro interno",
      500,
      corsHeaders
    );
  }
});

async function processarAlgo(supabase: SupabaseClient, body: unknown, correlationId: string) {
  // ...implementação...
}
```

---

## Regras obrigatórias

### Runtime e imports
- **Usar Deno**, não Node.js. Variáveis de ambiente via `Deno.env.get()`.
- Imports via URL (`https://esm.sh/...`) ou paths relativos (`../`).
- Nunca usar `require()` ou `process.env`.

### Respostas
- **Formato padrão:** `{ ok: boolean, data?, error?, hint? }`
- `ok: true` + `data` em sucesso.
- `ok: false` + `error` + `hint` (opcional) em erro.
- Sempre incluir headers CORS nas respostas.

### Logs
- Incluir `correlationId` em todos os logs de erro.
- Nunca logar dados pessoais (email, telefone, endereço).
- Nível de log:
  - `console.log` para eventos de fluxo normal.
  - `console.error` para erros e exceções.

### Autenticação
- Funções de admin: validar JWT e role do usuário.
- Funções de webhook: validar assinatura/token do provider.
- Funções públicas (ex.: calcular frete): validar CORS por origem.

### Timeouts e erros de rede
- Usar `fetchWithTimeout` de `_shared/fetchWithTimeout.ts` para chamadas externas.
- Sempre tratar erros de rede com mensagem descritiva.

---

## Helpers compartilhados (`_shared/`)

| Arquivo | Uso |
|---------|-----|
| `cors.ts` | `getCorsHeaders(origin)` – headers CORS por origem |
| `response.ts` | `successResponse(data, corsHeaders, status?)`, `errorResponse(message, status, corsHeaders, hint?)` – formato `{ ok, data?, error?, hint? }` |
| `log.ts` | `logError(scope, correlationId, error, context?)`, `logInfo(scope, correlationId, message, context?)` – log estruturado com PII filtrado |
| `fetchWithTimeout.ts` | `fetchWithTimeout(url, options, timeoutMs)` – fetch com timeout |
| `appmax.ts` | Helpers específicos da integração Appmax |
| `bling-sync-fields.ts` | Mapeamento de campos para sync com Bling |

---

## Convenções de nomenclatura de functions

| Tipo | Prefixo | Exemplo |
|------|---------|---------|
| Checkout | `checkout-` | `checkout-create-session` |
| Stripe | `checkout-stripe-` | `checkout-stripe-webhook` |
| Yampi | `yampi-` | `yampi-webhook` |
| Appmax | `appmax-` | `appmax-webhook` |
| Bling | `bling-` | `bling-webhook` |
| SEO | `seo-` | `seo-sitemap` |
| Admin | `admin-` | `admin-commerce-action` |
| Cron | `cron-` | `cron-cleanup-logs` |
| Integrações | `integrations-` | `integrations-test` |

---

## Como criar uma nova Edge Function

```bash
# 1. Criar o diretório
mkdir supabase/functions/nome-da-funcao

# 2. Criar o arquivo principal
# (copiar o template da seção "Estrutura padrão" acima)
touch supabase/functions/nome-da-funcao/index.ts

# 3. Testar localmente
supabase functions serve nome-da-funcao

# 4. Deploy
supabase functions deploy nome-da-funcao
```

Após criar, adicionar no inventário de APIs em [`API_INVENTORY.md`](API_INVENTORY.md).
