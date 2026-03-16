# Consistência de stack (runtimes e linguagens)

Documento que descreve os runtimes e linguagens usados no projeto e as decisões de consistência.

## Visão geral

| Área | Runtime | Linguagem | Observações |
|------|---------|-----------|-------------|
| **Aplicação web** | Node.js (via Vite) | TypeScript | `package.json`: `"type": "module"`, build e dev com Vite |
| **Scripts CLI** | Node.js | JavaScript (.mjs) | `scripts/*.mjs` executados com `node`; ESM explícito |
| **Edge Functions (Supabase)** | Deno | TypeScript | Todas as funções em `supabase/functions/**/index.ts` |
| **Testes** | Node.js (Vitest/Playwright) | TypeScript | Mesmo runtime da app |

## Decisões

### 1. Aplicação e scripts: Node.js

- O frontend roda em Node durante o build (Vite) e em navegador no runtime.
- Scripts de automação (`seed:qa`, `reservations:cleanup`, `reconcile:stale`, `load:checkout`) usam **Node.js** com arquivos **.mjs** (ESM). Não há uso de Bun ou de CommonJS (.cjs) no projeto.
- **Consistência:** Manter todos os scripts em Node + ESM (.mjs). Se no futuro for desejável migrar para TypeScript, usar `ts-node` ou `tsx` com o mesmo runtime Node.

### 2. Edge Functions: Deno

- As Supabase Edge Functions rodam em **Deno** (runtime padrão do Supabase).
- Todas são escritas em **TypeScript** e importam de URLs ESM (`esm.sh`, `deno.land`).
- **Consistência:** Não introduzir código Node-specific (ex.: `require`, `process`) nas Edge Functions; usar apenas APIs Deno/Web Standard.

### 3. Linguagem única: TypeScript no código da aplicação

- Todo o código em `src/` é TypeScript (.ts/.tsx).
- Scripts em `scripts/` são JavaScript (.mjs) por simplicidade e execução direta com `node`; não há TypeScript nos scripts atualmente.
- **Recomendação:** Ao adicionar novos scripts, preferir manter .mjs com JSDoc para tipos, ou migrar para TS com `tsx`/`ts-node` se o time padronizar em TS em todo o repositório.

### 4. O que não usar

- **Bun:** Não utilizado; não introduzir sem decisão explícita de stack.
- **CommonJS (.cjs, require):** Não utilizado; o projeto é ESM (`"type": "module"`).
- **`any` desnecessário:** Evitar em TypeScript; tipar com tipos de domínio ou `unknown` quando apropriado (melhoria contínua, ver Fase 2 do ROADMAP).

## Verificação

- **Lint/typecheck:** `npm run lint` e `npm run typecheck` garantem que o código em `src/` siga os padrões do projeto.
- **Edge Functions:** Seguir `docs/EDGE_FUNCTIONS_GUIDE.md`; imports via URL ESM; sem dependências Node.

## Referências

- `package.json`: scripts e `"type": "module"`
- `docs/EDGE_FUNCTIONS_GUIDE.md`: padrão das Edge Functions
- `docs/ROADMAP.md`: Fase 2 (consistência de runtimes e eliminação de `any`)
