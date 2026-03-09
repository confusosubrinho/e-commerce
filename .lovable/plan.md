

# Fix: Crash na Sincronização Yampi por Data Inválida

## Problema

Os logs mostram:
```
RangeError: Invalid time value
    at Date.toISOString
    at yampi-sync-order-status/index.ts:195
```

Linha 213 do código faz `new Date(yampiOrderDate).toISOString()` sem validação. Se a API Yampi retorna uma data em formato inesperado, o `Date` constructor gera um `Invalid Date` e `.toISOString()` lança `RangeError`, crashando a função inteira — daí o "Failed to fetch".

## Correção

No `supabase/functions/yampi-sync-order-status/index.ts`, linha 213:

Substituir:
```typescript
const yampiCreatedAt = yampiOrderDate ? new Date(yampiOrderDate).toISOString() : null;
```

Por:
```typescript
let yampiCreatedAt: string | null = null;
if (yampiOrderDate) {
  const d = new Date(yampiOrderDate);
  if (!isNaN(d.getTime())) yampiCreatedAt = d.toISOString();
  else console.warn("[yampi-sync] Invalid date ignored:", yampiOrderDate);
}
```

Isso valida a data antes de converter e evita o crash.

## Arquivo
- `supabase/functions/yampi-sync-order-status/index.ts` (1 linha → 5 linhas)

