import { describe, expect, it } from "vitest";
import {
  auditBlingSaldosBatch,
  BlingStockCircuitBreaker,
  evaluateSkuRelinkOnProduct,
  explicitSaldoFromBlingStockRow,
  explicitSaldoFromLegacyEstoque,
  explicitSaldoFromWebhookPayload,
  normalizeBlingSku,
  resolveSafeStockUpdate,
} from "../../supabase/functions/_shared/blingStockSafe.ts";

describe("blingStockSafe (política conservadora Bling)", () => {
  it("aceita zero explícito da API", () => {
    expect(explicitSaldoFromBlingStockRow({ saldoVirtualTotal: 0, produto: { id: 1 } })).toBe(0);
  });

  it("rejeita null/undefined/ausente como não confirmado", () => {
    expect(explicitSaldoFromBlingStockRow({ saldoVirtualTotal: null, produto: { id: 1 } })).toBeUndefined();
    expect(explicitSaldoFromBlingStockRow({ produto: { id: 1 } })).toBeUndefined();
  });

  it("webhook payload numérico ou string", () => {
    expect(explicitSaldoFromWebhookPayload(5)).toBe(5);
    expect(explicitSaldoFromWebhookPayload(0)).toBe(0);
    expect(explicitSaldoFromWebhookPayload("12")).toBe(12);
    expect(explicitSaldoFromWebhookPayload(undefined)).toBeUndefined();
  });

  it("legado retorno.estoques", () => {
    expect(explicitSaldoFromLegacyEstoque({ saldoVirtualTotal: 3 })).toBe(3);
    expect(explicitSaldoFromLegacyEstoque({ quantidade: "2" })).toBe(2);
    expect(explicitSaldoFromLegacyEstoque({})).toBeUndefined();
  });

  it("auditBlingSaldosBatch detecta lote parcial (falta saldo explícito)", () => {
    const requested = [10, 20, 30];
    const rows = [
      { produto: { id: 10 }, saldoVirtualTotal: 5 },
      { produto: { id: 20 } },
    ];
    const a = auditBlingSaldosBatch(requested, rows);
    expect(a.is_partial_for_requested).toBe(true);
    expect(a.ids_with_explicit_saldo.sort()).toEqual([10]);
    expect(a.requested_missing_explicit_saldo.sort()).toEqual([20, 30]);
    expect(a.returned_rows_saldo_not_explicit).toContain(20);
  });

  it("normalizeBlingSku só faz trim", () => {
    expect(normalizeBlingSku("  ABC-1  ")).toBe("ABC-1");
    expect(normalizeBlingSku(null)).toBe("");
  });

  describe("resolveSafeStockUpdate", () => {
    it("bloqueia quando batch HTTP não ok", () => {
      const r = resolveSafeStockUpdate({
        batchHttpOk: false,
        explicitSaldo: 5,
        inPartialBatchMissingSaldo: false,
        hasRecentLocalMovement: false,
        matchType: "bling_variant_id",
        oldStock: 1,
      });
      expect(r.decision).toBe("skipped_batch_http_error");
      expect(r.shouldApplyStock).toBe(false);
    });

    it("lote parcial: id pedido sem saldo explícito → skipped_partial_batch", () => {
      const r = resolveSafeStockUpdate({
        batchHttpOk: true,
        explicitSaldo: undefined,
        inPartialBatchMissingSaldo: true,
        hasRecentLocalMovement: false,
        matchType: "bling_variant_id",
        oldStock: 10,
      });
      expect(r.decision).toBe("skipped_partial_batch");
      expect(r.shouldApplyStock).toBe(false);
    });

    it("saldo explícito + movimento local recente → não aplica", () => {
      const r = resolveSafeStockUpdate({
        batchHttpOk: true,
        explicitSaldo: 3,
        inPartialBatchMissingSaldo: false,
        hasRecentLocalMovement: true,
        matchType: "bling_variant_id",
        oldStock: 10,
      });
      expect(r.decision).toBe("skipped_recent_local_movement");
      expect(r.new_stock).toBe(3);
      expect(r.shouldApplyStock).toBe(false);
    });

    it("saldo explícito e sem bloqueio → would_update quando muda", () => {
      const r = resolveSafeStockUpdate({
        batchHttpOk: true,
        explicitSaldo: 7,
        inPartialBatchMissingSaldo: false,
        hasRecentLocalMovement: false,
        matchType: "bling_variant_id",
        oldStock: 2,
      });
      expect(r.decision).toBe("would_update");
      expect(r.shouldApplyStock).toBe(true);
      expect(r.new_stock).toBe(7);
    });
  });

  it("evaluateSkuRelinkOnProduct rejeita SKU duplicado normalizado no produto", () => {
    const bad = evaluateSkuRelinkOnProduct(
      [
        { id: "a", sku: "X-1" },
        { id: "b", sku: "  X-1  " },
      ],
      "X-1",
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect((bad as { ok: false; reason: string }).reason).toContain("ambiguous");

    const good = evaluateSkuRelinkOnProduct([{ id: "a", sku: "  Y  " }], "Y");
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.variantId).toBe("a");
  });

  it("BlingStockCircuitBreaker dispara por ratio de missing saldo", () => {
    const c = new BlingStockCircuitBreaker({
      missingSaldoPercentThreshold: 30,
      maxZeroStockUpdates: 999,
      minRequestedForPercentRule: 10,
    });
    const audit = auditBlingSaldosBatch(
      Array.from({ length: 10 }, (_, i) => i + 1),
      [],
    );
    c.recordBatchAudit(audit);
    const ev = c.evaluateAfterBatch();
    expect(ev.tripped).toBe(true);
    expect(ev.reason).toBeDefined();
  });

  it("BlingStockCircuitBreaker dispara por muitos updates para zero", () => {
    const c = new BlingStockCircuitBreaker({
      missingSaldoPercentThreshold: 100,
      maxZeroStockUpdates: 2,
      minRequestedForPercentRule: 999,
    });
    c.recordAppliedStockUpdate(5, 0);
    c.recordAppliedStockUpdate(3, 0);
    const ev = c.evaluateAfterBatch();
    expect(ev.tripped).toBe(true);
  });
});
