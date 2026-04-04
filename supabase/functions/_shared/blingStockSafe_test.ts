/**
 * Rodar: deno test --allow-read supabase/functions/_shared/blingStockSafe_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  explicitSaldoFromBlingStockRow,
  explicitSaldoFromLegacyEstoque,
  explicitSaldoFromWebhookPayload,
} from "./blingStockSafe.ts";

Deno.test("explicitSaldoFromBlingStockRow: zero explícito é válido", () => {
  assertEquals(explicitSaldoFromBlingStockRow({ saldoVirtualTotal: 0, produto: { id: 1 } }), 0);
});

Deno.test("explicitSaldoFromBlingStockRow: null/undefined não confirma saldo", () => {
  assertEquals(explicitSaldoFromBlingStockRow({ saldoVirtualTotal: null, produto: { id: 1 } }), undefined);
  assertEquals(explicitSaldoFromBlingStockRow({ produto: { id: 1 } }), undefined);
});

Deno.test("explicitSaldoFromWebhookPayload", () => {
  assertEquals(explicitSaldoFromWebhookPayload(5), 5);
  assertEquals(explicitSaldoFromWebhookPayload(0), 0);
  assertEquals(explicitSaldoFromWebhookPayload(undefined), undefined);
  assertEquals(explicitSaldoFromWebhookPayload(null), undefined);
});

Deno.test("explicitSaldoFromLegacyEstoque", () => {
  assertEquals(explicitSaldoFromLegacyEstoque({ saldoVirtualTotal: 3 }), 3);
  assertEquals(explicitSaldoFromLegacyEstoque({ quantidade: "2" }), 2);
  assertEquals(explicitSaldoFromLegacyEstoque({}), undefined);
});
