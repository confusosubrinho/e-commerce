# Guia de Edge Functions

Padrão de desenvolvimento para todas as Supabase Edge Functions do projeto.

> Runtime: **TypeScript/Deno** (não Node.js). Usar `import/export` ESM, nunca `require()`.

---

## Estrutura padrão de uma Edge Function

```typescript
// supabase/functions/nome-da-funcao/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// Handler principal – pequeno, só faz parse e delega
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  // 1. Tratar preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(origin) });
  }

  const correlationId = crypto.randomUUID();

  try {
    // 2. Validar autenticação (se necessário)
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return errorResponse("Unauthorized", 401, getCorsHeaders(origin));
    }

    // 3. Parse do body
    const body = await req.json();

    // 4. Criar cliente Supabase com o token do usuário (ou service role)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // 5. Executar lógica de negócio (delegar para helper)
    const result = await processarAlgo(supabase, body, correlationId);

    // 6. Resposta de sucesso
    return successResponse(result, getCorsHeaders(origin));

  } catch (error) {
    console.error(`[nome-da-funcao][${correlationId}]`, error);
    return errorResponse(
      error instanceof Error ? error.message : "Erro interno",
      500,
      getCorsHeaders(origin)
    );
  }
});

// Helpers de resposta padronizados
function successResponse(data: unknown, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ ok: true, data }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
  );
}

function errorResponse(message: string, status: number, corsHeaders: Record<string, string>, hint?: string) {
  return new Response(
    JSON.stringify({ ok: false, error: message, hint }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status }
  );
}

// Lógica de negócio em função separada
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
