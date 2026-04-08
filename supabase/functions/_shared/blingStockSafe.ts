/**
 * Regras conservadoras para sincronização de estoque com o Bling.
 * Na dúvida, não atualizar — nunca tratar ausência/null como zero.
 */

export type BlingStockLogMeta = Record<string, unknown>;

/** Saldo explícito: número finito retornado pelo Bling (0 é válido). null/undefined/ausente → não confirmado. */
const STOCK_VALUE_KEYS = [
  "saldoVirtualTotal",
  "saldoFisicoTotal",
  "saldoVirtual",
  "saldoFisico",
  "saldoDisponivel",
  "saldo",
  "quantidade",
] as const;

const STOCK_CONTAINER_KEYS = [
  "estoque",
  "estoques",
  "saldos",
  "depositos",
  "depósitos",
] as const;

function parseExplicitStockValue(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.trunc(raw));
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw.replace(",", "."));
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  }
  return undefined;
}

function extractStockCandidateValues(source: unknown, depth = 0): number[] {
  const direct = parseExplicitStockValue(source);
  const out: number[] = direct !== undefined ? [direct] : [];
  if (source == null || typeof source !== "object") return out;

  const record = source as Record<string, unknown>;
  for (const key of STOCK_VALUE_KEYS) {
    const parsed = parseExplicitStockValue(record[key]);
    if (parsed !== undefined) out.push(parsed);
  }

  if (depth >= 1) return out;
  for (const key of STOCK_CONTAINER_KEYS) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      for (const item of nested) out.push(...extractStockCandidateValues(item, depth + 1));
      continue;
    }
    out.push(...extractStockCandidateValues(nested, depth + 1));
  }

  return out;
}

export function explicitSaldoFromBlingStockRow(s: unknown): number | undefined {
  const candidates = extractStockCandidateValues(s);
  if (candidates.length === 0) return undefined;
  return Math.max(...candidates);
}

/** Payload legado (retorno.estoques): tenta campos conhecidos; só aceita número finito explícito. */
export function explicitSaldoFromLegacyEstoque(est: unknown): number | undefined {
  const candidates = extractStockCandidateValues(est);
  if (candidates.length === 0) return undefined;
  return Math.max(...candidates);
}

/** Webhook V3: saldo no payload do evento (número ou string numérica explícita). */
export function explicitSaldoFromWebhookPayload(raw: unknown): number | undefined {
  const candidates = extractStockCandidateValues(raw);
  if (candidates.length === 0) return undefined;
  return Math.max(...candidates);
}

/**
 * Mescla linhas de GET /estoques/saldos no mapa só quando saldo é explícito.
 * Ignora linhas sem produto.id ou sem saldo numérico (log opcional).
 */
export function mergeExplicitSaldosIntoMap(
  map: Map<number, number>,
  rows: unknown[],
  logContext: string,
  logPartialRow = true,
): void {
  for (const s of rows) {
    if (s == null || typeof s !== "object") continue;
    const pid = (s as { produto?: { id?: unknown } }).produto?.id;
    if (pid == null || typeof pid !== "number") continue;
    const saldo = explicitSaldoFromBlingStockRow(s);
    if (saldo === undefined) {
      if (logPartialRow) {
        console.warn(JSON.stringify({
          level: "warn",
          message: "Bling stock skipped: missing explicit stock saldo fields in API row",
          context: logContext,
          bling_produto_id: pid,
        }));
      }
      continue;
    }
    map.set(pid, saldo);
  }
}

export function logBlingStockEvent(
  message: string,
  context: string,
  meta: BlingStockLogMeta = {},
): void {
  console.warn(JSON.stringify({ level: "warn", message, context, ...meta }));
}

export type BlingVariantSyncAction = "updated" | "skipped" | "mismatch" | "failed";

export interface BlingVariantSyncActionLogInput {
  action: BlingVariantSyncAction;
  context: string;
  correlation_id?: string;
  product_id?: string;
  variant_id?: string;
  local_sku?: string | null;
  bling_variant_id?: number | null;
  previous_stock?: number;
  new_stock?: number;
  reason?: string;
  decision?: string;
  match_type?: string | null;
}

/**
 * Log estruturado por variante para auditoria de sync de estoque.
 * Campos estáveis esperados:
 * - product_id, variant_id, local_sku
 * - bling_variant_id
 * - previous_stock, new_stock
 * - action: updated|skipped|mismatch|failed
 */
export function logBlingVariantSyncAction(input: BlingVariantSyncActionLogInput): void {
  const level = input.action === "failed" ? "error" : input.action === "mismatch" ? "warn" : "info";
  const payload = {
    level,
    message: "Bling variant stock sync action",
    action: input.action,
    context: input.context,
    correlation_id: input.correlation_id,
    product_id: input.product_id,
    variant_id: input.variant_id,
    local_sku: input.local_sku ?? null,
    bling_variant_id: input.bling_variant_id ?? null,
    previous_stock: input.previous_stock,
    new_stock: input.new_stock,
    reason: input.reason,
    decision: input.decision,
    match_type: input.match_type ?? null,
  };
  const cleaned = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
  const line = JSON.stringify(cleaned);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Prioridade de match para reconciliação (documentação / telemetria). */
export type BlingStockMatchType = "bling_variant_id" | "bling_product_id_parent" | "sku_relink" | "none";

/** Resultado conceitual de uma decisão de sync (para logs e futura coluna no DB). */
export type BlingStockDecisionKind =
  | "would_update"
  | "skipped_missing_explicit_saldo"
  | "skipped_no_mapping"
  | "skipped_recent_local_movement"
  | "skipped_batch_http_error"
  | "skipped_partial_batch";

export interface BlingSaldosBatchAudit {
  requested_ids: number[];
  row_count: number;
  /** IDs pedidos que receberam saldo explícito neste lote (interseção). */
  ids_with_explicit_saldo: number[];
  /** IDs pedidos que não vieram com saldo confirmável (parcial ou ausente). */
  requested_missing_explicit_saldo: number[];
  /** ID apareceu na resposta mas sem saldoVirtualTotal numérico (payload incompleto). */
  returned_rows_saldo_not_explicit: number[];
  is_partial_for_requested: boolean;
}

/**
 * Compara o lote pedido ao array `data` de /estoques/saldos.
 * Não assume zero: só conta como "presente" quem tem saldo explícito.
 */
export function auditBlingSaldosBatch(requestedIds: number[], rows: unknown[]): BlingSaldosBatchAudit {
  const requestedSet = new Set(requestedIds);
  const explicitForRequested = new Set<number>();
  const returnedSaldoWeak = new Set<number>();

  for (const s of rows) {
    if (s == null || typeof s !== "object") continue;
    const pid = (s as { produto?: { id?: unknown } }).produto?.id;
    if (pid == null || typeof pid !== "number") continue;
    if (!requestedSet.has(pid)) continue;
    returnedSaldoWeak.add(pid);
    const saldo = explicitSaldoFromBlingStockRow(s);
    if (saldo !== undefined) explicitForRequested.add(pid);
  }

  const requested_missing_explicit_saldo = requestedIds.filter((id) => !explicitForRequested.has(id));
  const returned_rows_saldo_not_explicit = [...returnedSaldoWeak].filter((id) => !explicitForRequested.has(id));

  return {
    requested_ids: [...requestedIds],
    row_count: rows.length,
    ids_with_explicit_saldo: [...explicitForRequested],
    requested_missing_explicit_saldo,
    returned_rows_saldo_not_explicit,
    is_partial_for_requested: requested_missing_explicit_saldo.length > 0,
  };
}

export function logBlingSaldosBatchAudit(
  audit: BlingSaldosBatchAudit,
  context: string,
  extra: BlingStockLogMeta = {},
): void {
  if (!audit.is_partial_for_requested) return;
  const cap = 30;
  const missing = audit.requested_missing_explicit_saldo;
  console.warn(JSON.stringify({
    level: "warn",
    message: "Bling saldos batch partial: some requested ids lack explicit saldo in this response",
    context,
    row_count: audit.row_count,
    requested_count: audit.requested_ids.length,
    explicit_count: audit.ids_with_explicit_saldo.length,
    missing_count: missing.length,
    missing_ids_sample: missing.slice(0, cap),
    weak_saldo_rows_sample: audit.returned_rows_saldo_not_explicit.slice(0, cap),
    ...extra,
  }));
}

/** Normalização mínima para comparação de SKU (só trim; não lowercaseniza por padrão para não quebrar SKUs case-sensitive). */
export function normalizeBlingSku(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

/** true se o id Bling estava no lote pedido e a auditoria indica falta de saldo explícito. */
export function blingIdMissingExplicitInAudit(audit: BlingSaldosBatchAudit, blingProdutoId: number): boolean {
  return audit.requested_missing_explicit_saldo.includes(blingProdutoId);
}

/**
 * Fallback por produto-pai é permitido apenas para produtos simples
 * (exatamente uma variante ativa local).
 */
export function canApplyParentStockFallback(activeVariantCount: number): boolean {
  return Number.isFinite(activeVariantCount) && activeVariantCount === 1;
}

// ─── Decisão centralizada de escrita de estoque ───

export interface ResolveSafeStockUpdateInput {
  batchHttpOk: boolean;
  explicitSaldo: number | undefined;
  /** true quando este idsProdutos estava no batch e a resposta não trouxe saldoVirtualTotal confirmável */
  inPartialBatchMissingSaldo: boolean;
  hasRecentLocalMovement: boolean;
  matchType: BlingStockMatchType;
  oldStock?: number;
}

export interface ResolveSafeStockUpdateResult {
  decision: BlingStockDecisionKind;
  match_type?: BlingStockMatchType;
  old_stock?: number;
  new_stock?: number;
  skip_reason?: string;
  /** Aplicar stock_quantity = new_stock quando true (e new_stock definido) */
  shouldApplyStock: boolean;
}

/**
 * Regra única: sem HTTP ok → não escreve; sem saldo explícito → não escreve;
 * lote parcial para este id → skipped_partial_batch; movimento local recente → não sobrescreve.
 */
export function resolveSafeStockUpdate(input: ResolveSafeStockUpdateInput): ResolveSafeStockUpdateResult {
  const { matchType, oldStock } = input;
  if (!input.batchHttpOk) {
    return {
      decision: "skipped_batch_http_error",
      match_type: matchType,
      old_stock: oldStock,
      skip_reason: "batch_http_not_ok",
      shouldApplyStock: false,
    };
  }
  if (input.explicitSaldo === undefined) {
    if (input.inPartialBatchMissingSaldo) {
      return {
        decision: "skipped_partial_batch",
        match_type: matchType,
        old_stock: oldStock,
        skip_reason: "requested_id_missing_explicit_saldo_in_batch_response",
        shouldApplyStock: false,
      };
    }
    return {
      decision: "skipped_missing_explicit_saldo",
      match_type: matchType,
      old_stock: oldStock,
      skip_reason: "no_explicit_saldo",
      shouldApplyStock: false,
    };
  }
  const newStock = input.explicitSaldo;
  if (input.hasRecentLocalMovement) {
    return {
      decision: "skipped_recent_local_movement",
      match_type: matchType,
      old_stock: oldStock,
      new_stock: newStock,
      skip_reason: "recent_local_movement_within_window",
      shouldApplyStock: false,
    };
  }
  const changed = oldStock === undefined || oldStock !== newStock;
  return {
    decision: "would_update",
    match_type: matchType,
    old_stock: oldStock,
    new_stock: newStock,
    skip_reason: changed ? undefined : "stock_unchanged",
    shouldApplyStock: changed,
  };
}

/** Colunas opcionais em product_variants (após migração). */
export function blingVariantSyncDecisionColumns(
  result: ResolveSafeStockUpdateResult,
  source: string,
): {
  bling_last_sync_decision: string;
  bling_last_sync_source: string;
  bling_last_match_type: string | null;
} {
  return {
    bling_last_sync_decision: result.decision,
    bling_last_sync_source: source,
    bling_last_match_type: result.match_type ?? null,
  };
}

// ─── Relink por SKU (unicidade normalizada no produto) ───

export type SkuRelinkEvaluation =
  | { ok: true; variantId: string }
  | { ok: false; reason: string };

/**
 * Exige exatamente uma variante no produto com SKU normalizado igual ao informado.
 */
export function evaluateSkuRelinkOnProduct(
  variantsOnProduct: Array<{ id: string; sku: string | null }>,
  rawSkuFromBling: string | null | undefined,
): SkuRelinkEvaluation {
  const norm = normalizeBlingSku(rawSkuFromBling);
  if (!norm) return { ok: false, reason: "empty_or_whitespace_sku" };
  const matches = variantsOnProduct.filter((v) => normalizeBlingSku(v.sku) === norm);
  if (matches.length === 0) return { ok: false, reason: "no_variant_with_normalized_sku" };
  if (matches.length > 1) return { ok: false, reason: "ambiguous_duplicate_normalized_sku_on_product" };
  return { ok: true, variantId: matches[0].id };
}

// ─── Circuit breaker (execução cron / syncStock) ───

export interface BlingStockCircuitConfig {
  /** 0–100: dispara se (missingAcumulado / requestedAcumulado * 100) >= limite (mínimo requestedAcumulado >= minRequestedForPercent). */
  missingSaldoPercentThreshold: number;
  maxZeroStockUpdates: number;
  /** Evita disparo em amostras minúsculas */
  minRequestedForPercentRule: number;
}

export function defaultBlingStockCircuitConfig(): BlingStockCircuitConfig {
  return {
    missingSaldoPercentThreshold: 30,
    maxZeroStockUpdates: 40,
    minRequestedForPercentRule: 15,
  };
}

export function parseBlingStockCircuitConfig(env: Record<string, string | undefined>): BlingStockCircuitConfig {
  const d = defaultBlingStockCircuitConfig();
  const pct = Number(env["BLING_STOCK_CIRCUIT_MISSING_SALDO_PERCENT"]);
  const max0 = Number(env["BLING_STOCK_CIRCUIT_MAX_ZERO_UPDATES"]);
  const minR = Number(env["BLING_STOCK_CIRCUIT_MIN_REQUESTED_FOR_PERCENT"]);
  return {
    missingSaldoPercentThreshold: Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : d.missingSaldoPercentThreshold,
    maxZeroStockUpdates: Number.isFinite(max0) && max0 >= 1 ? max0 : d.maxZeroStockUpdates,
    minRequestedForPercentRule: Number.isFinite(minR) && minR >= 1 ? minR : d.minRequestedForPercentRule,
  };
}

export class BlingStockCircuitBreaker {
  cumulativeRequested = 0;
  cumulativeMissingExplicit = 0;
  zeroStockUpdates = 0;
  tripped = false;
  tripReason: string | undefined;

  constructor(public readonly config: BlingStockCircuitConfig) {}

  recordBatchAudit(audit: BlingSaldosBatchAudit): void {
    if (this.tripped) return;
    this.cumulativeRequested += audit.requested_ids.length;
    this.cumulativeMissingExplicit += audit.requested_missing_explicit_saldo.length;
  }

  /** Conta transições que definem estoque final 0 (comportamento destrutivo em massa). */
  recordAppliedStockUpdate(oldStock: number, newStock: number): void {
    if (this.tripped) return;
    if (newStock === 0) this.zeroStockUpdates++;
  }

  evaluateAfterBatch(): { tripped: boolean; reason?: string } {
    if (this.tripped) return { tripped: true, reason: this.tripReason };
    if (
      this.cumulativeRequested >= this.config.minRequestedForPercentRule &&
      this.cumulativeMissingExplicit > 0
    ) {
      const ratioPct = (this.cumulativeMissingExplicit / this.cumulativeRequested) * 100;
      if (ratioPct >= this.config.missingSaldoPercentThreshold) {
        this.tripped = true;
        this.tripReason = `missing_explicit_saldo_ratio_${ratioPct.toFixed(1)}_gte_${this.config.missingSaldoPercentThreshold}`;
        return { tripped: true, reason: this.tripReason };
      }
    }
    if (this.zeroStockUpdates >= this.config.maxZeroStockUpdates) {
      this.tripped = true;
      this.tripReason = `zero_stock_updates_${this.zeroStockUpdates}_gte_${this.config.maxZeroStockUpdates}`;
      return { tripped: true, reason: this.tripReason };
    }
    return { tripped: false };
  }
}
