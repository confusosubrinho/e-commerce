/**
 * Rodar: deno test --allow-read supabase/functions/_shared/blingStockSafe_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  canApplyParentStockFallback,
  explicitSaldoFromBlingStockRow,
  explicitSaldoFromLegacyEstoque,
  explicitSaldoFromWebhookPayload,
} from "./blingStockSafe.ts";

Deno.test("explicitSaldoFromBlingStockRow: zero explícito é válido", () => {
  assertEquals(explicitSaldoFromBlingStockRow({ saldoVirtualTotal: 0, produto: { id: 1 } }), 0);
});

Deno.test("explicitSaldoFromBlingStockRow: usa saldo positivo disponível entre campos conhecidos", () => {
  assertEquals(explicitSaldoFromBlingStockRow({ saldoVirtualTotal: 0, saldoFisicoTotal: 6, produto: { id: 1 } }), 6);
});

Deno.test("explicitSaldoFromBlingStockRow: null/undefined não confirma saldo", () => {
  assertEquals(explicitSaldoFromBlingStockRow({ saldoVirtualTotal: null, produto: { id: 1 } }), undefined);
  assertEquals(explicitSaldoFromBlingStockRow({ produto: { id: 1 } }), undefined);
});

Deno.test("explicitSaldoFromWebhookPayload", () => {
  assertEquals(explicitSaldoFromWebhookPayload(5), 5);
  assertEquals(explicitSaldoFromWebhookPayload(0), 0);
  assertEquals(explicitSaldoFromWebhookPayload({ saldoVirtualTotal: 0, saldoFisicoTotal: 4 }), 4);
  assertEquals(explicitSaldoFromWebhookPayload(undefined), undefined);
  assertEquals(explicitSaldoFromWebhookPayload(null), undefined);
});

Deno.test("explicitSaldoFromLegacyEstoque", () => {
  assertEquals(explicitSaldoFromLegacyEstoque({ saldoVirtualTotal: 3 }), 3);
  assertEquals(explicitSaldoFromLegacyEstoque({ quantidade: "2" }), 2);
  assertEquals(explicitSaldoFromLegacyEstoque({}), undefined);
});

Deno.test("canApplyParentStockFallback: só permite fallback com 1 variante ativa", () => {
  assertEquals(canApplyParentStockFallback(1), true);
  assertEquals(canApplyParentStockFallback(0), false);
  assertEquals(canApplyParentStockFallback(2), false);
  assertEquals(canApplyParentStockFallback(4), false);
});
