import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";
import { hasRecentLocalMovements } from "../_shared/blingStockPush.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { parseRequestedTenantId, resolveAdminTenantContext } from "../_shared/blingTenant.ts";
import {
  auditBlingSaldosBatch,
  blingVariantSyncDecisionColumns,
  BlingStockCircuitBreaker,
  canApplyParentStockFallback,
  evaluateSkuRelinkOnProduct,
  logBlingVariantSyncAction,
  logBlingSaldosBatchAudit,
  mergeExplicitSaldosIntoMap,
  normalizeBlingSku,
  parseBlingStockCircuitConfig,
  resolveSafeStockUpdate,
} from "../_shared/blingStockSafe.ts";

const BLING_API_URL = "https://api.bling.com.br/Api/v3";

function createSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Use shared token refresh with optimistic locking
import { getValidTokenSafe } from "../_shared/blingTokenRefresh.ts";

async function getValidToken(supabase: any, tenantId: string): Promise<string> {
  return getValidTokenSafe(supabase, { tenantId });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Não autorizado");

    const supabase = createSupabase();
    const body = await req.json();
    const requestedTenantId = parseRequestedTenantId(req, body);
    const tenantCtx = await resolveAdminTenantContext(supabase, user.id, requestedTenantId);
    const tenantId = tenantCtx.tenantId;

    // Check admin role — try user_roles first, then admin_members fallback
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      // Fallback: check admin_members
      const { data: memberData } = await supabase
        .from("admin_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .in("role", ["super_admin", "owner", "manager", "operator", "admin"])
        .eq("is_active", true)
        .maybeSingle();
      if (!memberData) throw new Error("Acesso negado: apenas administradores");
    }

    const { product_id } = body;
    if (!product_id) throw new Error("product_id é obrigatório");
    const correlationId = crypto.randomUUID();

    // 1. Fetch product with variants
    const { data: product, error: prodErr } = await supabase
      .from("products")
      .select("id, tenant_id, name, sku, is_active, bling_product_id, bling_sync_status")
      .eq("id", product_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (prodErr || !product) throw new Error("Produto não encontrado");

    // 2. Validate: must be active
    if (!product.is_active) {
      return new Response(JSON.stringify({
        success: false, error: "produto_inativo",
        message: "Produto inativo não pode ser sincronizado com o Bling",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Check bling_sync_config
    const { data: syncConfig } = await supabase
      .from("bling_sync_config")
      .select("sync_stock")
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();
    if (syncConfig && !syncConfig.sync_stock) {
      return new Response(JSON.stringify({
        success: false, error: "sync_disabled",
        message: "Sincronização de estoque está desabilitada nas configurações",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Resolve bling_product_id (or find by SKU)
    let blingProductId = product.bling_product_id;

    let searchSku = product.sku;

    if (!blingProductId) {
      // Try to find by SKU in Bling
      if (!searchSku) {
        // Also check variant SKUs
        const { data: variants } = await supabase
            .from("product_variants")
            .select("sku")
            .eq("product_id", product_id)
            .eq("tenant_id", tenantId)
            .not("sku", "is", null);
        
        const firstSku = variants?.[0]?.sku;
        if (!firstSku) {
          await supabase.from("products").update({
            bling_sync_status: "error",
            bling_last_error: "Produto sem bling_product_id e sem SKU para buscar no Bling",
          }).eq("id", product_id).eq("tenant_id", tenantId);
          return new Response(JSON.stringify({
            success: false, error: "no_bling_id",
            message: "Produto sem vínculo com o Bling e sem SKU para busca",
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        searchSku = firstSku;
      }
    }

    const token = await getValidToken(supabase, tenantId);
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}`, Accept: "application/json" };

    // If no bling_product_id, search by SKU
    if (!blingProductId) {
      const searchRes = await fetchWithTimeout(`${BLING_API_URL}/produtos?codigo=${encodeURIComponent(searchSku)}`, { headers });
      const searchJson = await searchRes.json();
      const found = searchJson?.data?.[0];
      if (!found) {
        await supabase.from("products").update({
          bling_sync_status: "error",
          bling_last_error: `Produto com SKU "${searchSku}" não encontrado no Bling`,
        }).eq("id", product_id).eq("tenant_id", tenantId);
        return new Response(JSON.stringify({
          success: false, error: "not_found_in_bling",
          message: `SKU "${searchSku}" não encontrado no Bling`,
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      blingProductId = found.id;
      // Link the bling_product_id for future syncs
      await supabase.from("products").update({ bling_product_id: blingProductId }).eq("id", product_id).eq("tenant_id", tenantId);
    }

    // 5. Fetch product detail from Bling to get variations
    const detailRes = await fetchWithTimeout(`${BLING_API_URL}/produtos/${blingProductId}`, { headers });
    if (!detailRes.ok) {
      const errBody = await detailRes.text();
      console.error(`[bling-sync-single-stock] Bling API returned ${detailRes.status} for product ${blingProductId}: ${errBody}`);
      // If 401, token may be expired — try refresh once
      if (detailRes.status === 401) {
        // Force token refresh and retry once
        const newToken = await getValidToken(supabase, tenantId);
        const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
        const retryRes = await fetchWithTimeout(`${BLING_API_URL}/produtos/${blingProductId}`, { headers: retryHeaders });
        if (!retryRes.ok) {
          const retryBody = await retryRes.text();
          await supabase.from("products").update({
            bling_sync_status: "error",
            bling_last_error: `Bling API erro ${retryRes.status}: ${retryBody.substring(0, 500)}`,
          }).eq("id", product_id).eq("tenant_id", tenantId);
          throw new Error(`Bling API erro ${retryRes.status} após retry: ${retryBody.substring(0, 200)}`);
        }
        const retryJson = await retryRes.json();
        var detail = retryJson?.data;
      } else if (detailRes.status === 429) {
        // Rate limited — wait and retry once
        await new Promise(r => setTimeout(r, 2000));
        const retryRes = await fetchWithTimeout(`${BLING_API_URL}/produtos/${blingProductId}`, { headers });
        if (!retryRes.ok) {
          await supabase.from("products").update({
            bling_sync_status: "error",
            bling_last_error: `Bling API rate-limited (429) persistente`,
          }).eq("id", product_id).eq("tenant_id", tenantId);
          throw new Error("Bling API rate-limited (429) após retry");
        }
        const retryJson = await retryRes.json();
        var detail = retryJson?.data;
      } else if (detailRes.status === 404) {
        // Product no longer exists in Bling — clear the invalid ID and try SKU search
        console.warn(`[bling-sync-single-stock] Product ${blingProductId} not found in Bling (404), clearing bling_product_id and searching by SKU`);
        await supabase.from("products").update({ bling_product_id: null }).eq("id", product_id).eq("tenant_id", tenantId);
        
        // Try to find by SKU
        if (searchSku) {
          const skuSearchRes = await fetchWithTimeout(`${BLING_API_URL}/produtos?codigo=${encodeURIComponent(searchSku)}`, { headers });
          if (skuSearchRes.ok) {
            const skuSearchJson = await skuSearchRes.json();
            const found = skuSearchJson?.data?.[0];
            if (found) {
              blingProductId = found.id;
              await supabase.from("products").update({ bling_product_id: blingProductId }).eq("id", product_id).eq("tenant_id", tenantId);
              // Re-fetch detail with new ID
              const reDetailRes = await fetchWithTimeout(`${BLING_API_URL}/produtos/${blingProductId}`, { headers });
              if (reDetailRes.ok) {
                const reDetailJson = await reDetailRes.json();
                var detail = reDetailJson?.data;
              }
            }
          }
        }
        
        if (!detail) {
          await supabase.from("products").update({
            bling_sync_status: "error",
            bling_last_error: `Produto ID ${blingProductId} não existe mais no Bling e SKU "${searchSku}" não encontrado`,
          }).eq("id", product_id).eq("tenant_id", tenantId);
          throw new Error(`Produto não encontrado no Bling (404) e busca por SKU "${searchSku}" falhou`);
        }
      } else {
        await supabase.from("products").update({
          bling_sync_status: "error",
          bling_last_error: `Bling API erro ${detailRes.status}: ${errBody.substring(0, 500)}`,
        }).eq("id", product_id).eq("tenant_id", tenantId);
        throw new Error(`Bling API erro ${detailRes.status}: ${errBody.substring(0, 200)}`);
      }
    } else {
      const detailJson = await detailRes.json();
      var detail = detailJson?.data;
    }
    if (!detail) throw new Error("Não foi possível obter detalhes do produto no Bling (resposta vazia)");

    // 6. Fetch stock from Bling
    const { data: localVariants } = await supabase
      .from("product_variants")
      .select("id, sku, bling_variant_id, stock_quantity, is_active")
      .eq("product_id", product_id)
      .eq("tenant_id", tenantId);

    let updatedVariants = 0;
    let skippedRecent = 0;
    let mismatchedVariants = 0;
    const activeLocalVariants = (localVariants || []).filter((v: any) => v.is_active !== false);

    // Collect all bling IDs to fetch stock in batch
    const blingIds: number[] = [];
    
    // Map: bling_variant_id -> local variant
    const variantByBlingId = new Map<number, any>();
    /** Última variante vista por SKU normalizado (para lookup rápido; relink valida unicidade) */
    const variantBySkuNorm = new Map<string, any>();
    const inactiveVariantByBlingId = new Set<number>();
    const inactiveVariantBySkuNorm = new Set<string>();

    for (const v of (localVariants || [])) {
      if (v.is_active === false) {
        if (v.bling_variant_id) inactiveVariantByBlingId.add(v.bling_variant_id);
        const inactiveSkuNorm = normalizeBlingSku(v.sku);
        if (inactiveSkuNorm) inactiveVariantBySkuNorm.add(inactiveSkuNorm);
        continue;
      }
      if (v.bling_variant_id) {
        variantByBlingId.set(v.bling_variant_id, v);
        blingIds.push(v.bling_variant_id);
      }
      const sn = normalizeBlingSku(v.sku);
      if (sn) variantBySkuNorm.set(sn, v);
    }

    // Also add parent product ID for stock query
    blingIds.push(blingProductId);

    // Add variation IDs from Bling detail
    if (detail.variacoes?.length) {
      for (const bv of detail.variacoes) {
        if (!variantByBlingId.has(bv.id)) blingIds.push(bv.id);
      }
    }

    // Fetch stock balances
    const uniqueIds = [...new Set(blingIds)];
    const stockMap = new Map<number, number>();
    let anyStockBatchFailed = false;
    const circuit = new BlingStockCircuitBreaker(parseBlingStockCircuitConfig({
      BLING_STOCK_CIRCUIT_MISSING_SALDO_PERCENT: Deno.env.get("BLING_STOCK_CIRCUIT_MISSING_SALDO_PERCENT") ?? undefined,
      BLING_STOCK_CIRCUIT_MAX_ZERO_UPDATES: Deno.env.get("BLING_STOCK_CIRCUIT_MAX_ZERO_UPDATES") ?? undefined,
      BLING_STOCK_CIRCUIT_MIN_REQUESTED_FOR_PERCENT: Deno.env.get("BLING_STOCK_CIRCUIT_MIN_REQUESTED_FOR_PERCENT") ?? undefined,
    }));
    let circuitTripped = false;

    outerSingle: for (let i = 0; i < uniqueIds.length; i += 50) {
      const batch = uniqueIds.slice(i, i + 50);
      const idsParam = batch.map(id => `idsProdutos[]=${id}`).join("&");
      try {
        const stockRes = await fetchWithTimeout(`${BLING_API_URL}/estoques/saldos?${idsParam}`, { headers });
        if (!stockRes.ok) {
          const errText = await stockRes.text();
          anyStockBatchFailed = true;
          console.warn(
            `[single-stock] estoques/saldos HTTP ${stockRes.status} (batch ${batch.slice(0, 3).join(",")}…): ${errText.substring(0, 300)}`
          );
          continue;
        }
        const stockJson = await stockRes.json();
        const rows = stockJson?.data || [];
        const batchAudit = auditBlingSaldosBatch(batch, rows);
        logBlingSaldosBatchAudit(batchAudit, "bling-sync-single-stock.batch", {
          correlation_id: correlationId,
          product_id,
          batch_offset: i,
        });
        circuit.recordBatchAudit(batchAudit);
        const evB = circuit.evaluateAfterBatch();
        if (evB.tripped) {
          circuitTripped = true;
          console.warn(JSON.stringify({
            level: "warn",
            message: "bling-sync-single-stock circuit tripped",
            correlation_id: correlationId,
            product_id,
            reason: evB.reason,
          }));
          break outerSingle;
        }
        mergeExplicitSaldosIntoMap(stockMap, rows, "bling-sync-single-stock.batch", true);
      } catch (e) {
        anyStockBatchFailed = true;
        console.warn(`[single-stock] estoques/saldos batch exception:`, e);
      }
    }

    const missingSaldoVarIds = detail.variacoes?.length
      ? detail.variacoes.map((x: { id: number }) => x.id).filter((id: number) => !stockMap.has(id))
      : [];
    const batchOkForStock = !anyStockBatchFailed && !circuitTripped;

    // 7. Update local variants with Bling stock (resolveSafeStockUpdate)
    if (detail.variacoes?.length) {
      variantsOuter: for (const bv of detail.variacoes) {
        if (inactiveVariantByBlingId.has(bv.id)) {
          logBlingVariantSyncAction({
            action: "skipped",
            context: "bling-sync-single-stock.variacoes",
            correlation_id: correlationId,
            product_id,
            bling_variant_id: bv.id,
            reason: "matched_inactive_variant",
          });
          mismatchedVariants++;
          continue;
        }

        const stock = stockMap.get(bv.id);
        const localVar = variantByBlingId.get(bv.id);
        const inPartial = missingSaldoVarIds.includes(bv.id);

        if (localVar) {
          const hasRecent = await hasRecentLocalMovements(supabase, localVar.id, 10, tenantId);
          const oldSq = localVar.stock_quantity ?? 0;
          const resolved = resolveSafeStockUpdate({
            batchHttpOk: batchOkForStock,
            explicitSaldo: stock,
            inPartialBatchMissingSaldo: inPartial,
            hasRecentLocalMovement: hasRecent,
            matchType: "bling_variant_id",
            oldStock: oldSq,
          });
          const meta = blingVariantSyncDecisionColumns(resolved, "bling-sync-single-stock");
          if (resolved.shouldApplyStock && resolved.new_stock !== undefined) {
            circuit.recordAppliedStockUpdate(oldSq, resolved.new_stock);
            const evZ = circuit.evaluateAfterBatch();
            if (evZ.tripped) {
              circuitTripped = true;
              console.warn(JSON.stringify({ level: "warn", message: "single-stock circuit tripped", correlation_id: correlationId, reason: evZ.reason }));
              break variantsOuter;
            }
            await supabase
              .from("product_variants")
              .update({ stock_quantity: resolved.new_stock, ...meta })
              .eq("id", localVar.id)
              .eq("tenant_id", tenantId);
            logBlingVariantSyncAction({
              action: "updated",
              context: "bling-sync-single-stock.variacoes",
              correlation_id: correlationId,
              product_id,
              variant_id: localVar.id,
              local_sku: localVar.sku ?? null,
              bling_variant_id: bv.id,
              previous_stock: oldSq,
              new_stock: resolved.new_stock,
              decision: resolved.decision,
              match_type: resolved.match_type ?? null,
            });
            if (resolved.new_stock !== oldSq) {
              await supabase.from("inventory_movements").insert({
                tenant_id: tenantId,
                variant_id: localVar.id,
                quantity: resolved.new_stock - oldSq,
                type: "bling_sync",
              }).then(() => {}, () => {});
            }
            updatedVariants++;
          } else {
            await supabase.from("product_variants").update(meta).eq("id", localVar.id).eq("tenant_id", tenantId);
            logBlingVariantSyncAction({
              action: "skipped",
              context: "bling-sync-single-stock.variacoes",
              correlation_id: correlationId,
              product_id,
              variant_id: localVar.id,
              local_sku: localVar.sku ?? null,
              bling_variant_id: bv.id,
              previous_stock: oldSq,
              new_stock: resolved.new_stock,
              reason: resolved.skip_reason,
              decision: resolved.decision,
              match_type: resolved.match_type ?? null,
            });
            if (hasRecent) skippedRecent++;
          }
        } else {
          const skuNorm = normalizeBlingSku(bv.codigo);
          if (!skuNorm) continue;
          if (inactiveVariantBySkuNorm.has(skuNorm)) {
            logBlingVariantSyncAction({
              action: "skipped",
              context: "bling-sync-single-stock.sku",
              correlation_id: correlationId,
              product_id,
              local_sku: bv.codigo ?? null,
              bling_variant_id: bv.id,
              reason: "matched_inactive_variant_by_sku",
            });
            mismatchedVariants++;
            continue;
          }
          const skuVar = variantBySkuNorm.get(skuNorm);
          if (!skuVar) continue;
          const relink = evaluateSkuRelinkOnProduct(activeLocalVariants, bv.codigo);
          if (!relink.ok) {
            console.warn(JSON.stringify({
              level: "warn",
              message: "SKU path skipped (unicidade)",
              context: "bling-sync-single-stock",
              product_id,
              reason: relink.reason,
              bling_variant_id: bv.id,
            }));
            logBlingVariantSyncAction({
              action: "mismatch",
              context: "bling-sync-single-stock.sku",
              correlation_id: correlationId,
              product_id,
              local_sku: bv.codigo ?? null,
              bling_variant_id: bv.id,
              reason: `sku_relink_${relink.reason}`,
            });
            mismatchedVariants++;
            continue;
          }
          if (relink.variantId !== skuVar.id) continue;

          if (stock === undefined) {
            await supabase
              .from("product_variants")
              .update({ bling_variant_id: bv.id })
              .eq("id", skuVar.id)
              .eq("tenant_id", tenantId);
            logBlingVariantSyncAction({
              action: "skipped",
              context: "bling-sync-single-stock.sku",
              correlation_id: correlationId,
              product_id,
              variant_id: skuVar.id,
              local_sku: skuVar.sku ?? null,
              bling_variant_id: bv.id,
              previous_stock: skuVar.stock_quantity ?? 0,
              reason: "missing_explicit_saldo",
            });
            continue;
          }
          const hasRecent = await hasRecentLocalMovements(supabase, skuVar.id, 10, tenantId);
          const oldSku = skuVar.stock_quantity ?? 0;
          const resolvedSku = resolveSafeStockUpdate({
            batchHttpOk: batchOkForStock,
            explicitSaldo: stock,
            inPartialBatchMissingSaldo: inPartial,
            hasRecentLocalMovement: hasRecent,
            matchType: "sku_relink",
            oldStock: oldSku,
          });
          const metaSku = blingVariantSyncDecisionColumns(resolvedSku, "bling-sync-single-stock.sku");
          if (resolvedSku.shouldApplyStock && resolvedSku.new_stock !== undefined) {
            circuit.recordAppliedStockUpdate(oldSku, resolvedSku.new_stock);
            const evZs = circuit.evaluateAfterBatch();
            if (evZs.tripped) {
              circuitTripped = true;
              break variantsOuter;
            }
            await supabase.from("product_variants").update({
              stock_quantity: resolvedSku.new_stock,
              bling_variant_id: bv.id,
              ...metaSku,
            }).eq("id", skuVar.id).eq("tenant_id", tenantId);
            logBlingVariantSyncAction({
              action: "updated",
              context: "bling-sync-single-stock.sku",
              correlation_id: correlationId,
              product_id,
              variant_id: skuVar.id,
              local_sku: skuVar.sku ?? null,
              bling_variant_id: bv.id,
              previous_stock: oldSku,
              new_stock: resolvedSku.new_stock,
              decision: resolvedSku.decision,
              match_type: resolvedSku.match_type ?? null,
            });
            if (resolvedSku.new_stock !== oldSku) {
              await supabase.from("inventory_movements").insert({
                tenant_id: tenantId,
                variant_id: skuVar.id,
                quantity: resolvedSku.new_stock - oldSku,
                type: "bling_sync",
              }).then(() => {}, () => {});
            }
            updatedVariants++;
          } else {
            await supabase
              .from("product_variants")
              .update({ bling_variant_id: bv.id, ...metaSku })
              .eq("id", skuVar.id)
              .eq("tenant_id", tenantId);
            logBlingVariantSyncAction({
              action: "skipped",
              context: "bling-sync-single-stock.sku",
              correlation_id: correlationId,
              product_id,
              variant_id: skuVar.id,
              local_sku: skuVar.sku ?? null,
              bling_variant_id: bv.id,
              previous_stock: oldSku,
              new_stock: resolvedSku.new_stock,
              reason: resolvedSku.skip_reason,
              decision: resolvedSku.decision,
              match_type: resolvedSku.match_type ?? null,
            });
            if (hasRecent) skippedRecent++;
          }
        }
      }
    } else {
      const parentStock = stockMap.get(blingProductId);
      const parentMissing = !stockMap.has(blingProductId);
      const activeVariants = activeLocalVariants;
      if (!canApplyParentStockFallback(activeVariants.length)) {
        for (const lv of activeVariants) {
          logBlingVariantSyncAction({
            action: "mismatch",
            context: "bling-sync-single-stock.simple",
            correlation_id: correlationId,
            product_id,
            variant_id: lv.id,
            local_sku: lv.sku ?? null,
            bling_variant_id: blingProductId,
            previous_stock: lv.stock_quantity ?? 0,
            reason: "parent_stock_not_applied_to_multi_variant_product",
          });
          mismatchedVariants++;
        }
      } else if (canApplyParentStockFallback(activeVariants.length)) {
        const lv = activeVariants[0];
        const hasRecent = await hasRecentLocalMovements(supabase, lv.id, 10, tenantId);
        const oldLv = lv.stock_quantity ?? 0;
        const resolvedP = resolveSafeStockUpdate({
          batchHttpOk: batchOkForStock,
          explicitSaldo: parentStock,
          inPartialBatchMissingSaldo: parentMissing,
          hasRecentLocalMovement: hasRecent,
          matchType: "bling_product_id_parent",
          oldStock: oldLv,
        });
        const metaP = blingVariantSyncDecisionColumns(resolvedP, "bling-sync-single-stock.simple");
        if (resolvedP.shouldApplyStock && resolvedP.new_stock !== undefined) {
          circuit.recordAppliedStockUpdate(oldLv, resolvedP.new_stock);
          const evZp = circuit.evaluateAfterBatch();
          if (evZp.tripped) {
            circuitTripped = true;
          } else {
            await supabase
              .from("product_variants")
              .update({ stock_quantity: resolvedP.new_stock, ...metaP })
              .eq("id", lv.id)
              .eq("tenant_id", tenantId);
            logBlingVariantSyncAction({
              action: "updated",
              context: "bling-sync-single-stock.simple",
              correlation_id: correlationId,
              product_id,
              variant_id: lv.id,
              local_sku: lv.sku ?? null,
              bling_variant_id: blingProductId,
              previous_stock: oldLv,
              new_stock: resolvedP.new_stock,
              decision: resolvedP.decision,
              match_type: resolvedP.match_type ?? null,
            });
            if (resolvedP.new_stock !== oldLv) {
              await supabase.from("inventory_movements").insert({
                tenant_id: tenantId,
                variant_id: lv.id,
                quantity: resolvedP.new_stock - oldLv,
                type: "bling_sync",
              }).then(() => {}, () => {});
            }
            updatedVariants++;
          }
        } else {
          await supabase.from("product_variants").update(metaP).eq("id", lv.id).eq("tenant_id", tenantId);
          logBlingVariantSyncAction({
            action: "skipped",
            context: "bling-sync-single-stock.simple",
            correlation_id: correlationId,
            product_id,
            variant_id: lv.id,
            local_sku: lv.sku ?? null,
            bling_variant_id: blingProductId,
            previous_stock: oldLv,
            new_stock: resolvedP.new_stock,
            reason: resolvedP.skip_reason,
            decision: resolvedP.decision,
            match_type: resolvedP.match_type ?? null,
          });
          if (hasRecent) skippedRecent++;
          if (parentStock === undefined) {
            console.warn(JSON.stringify({
              level: "warn",
              message: "Bling stock skipped: no explicit saldo for parent product",
              context: "bling-sync-single-stock",
              product_id,
              bling_product_id: blingProductId,
            }));
          }
        }
      }
    }

    // 8. Update sync status
    const now = new Date().toISOString();
    await supabase.from("products").update({
      bling_sync_status: "synced",
      bling_last_synced_at: now,
      bling_last_error: null,
    }).eq("id", product_id).eq("tenant_id", tenantId);

    // 9. Log the sync action
    await supabase.from("product_change_log").insert({
      tenant_id: tenantId,
      product_id,
      changed_by: user.id,
      change_type: "bling_stock_sync",
      fields_changed: ["stock_quantity"],
      notes: `Sincronização manual de estoque via Bling. ${updatedVariants} variante(s) atualizada(s)${skippedRecent > 0 ? `, ${skippedRecent} ignorada(s) por movimentos recentes` : ''}.`,
      after_data: { updated_variants: updatedVariants, skipped_recent: skippedRecent, mismatched_variants: mismatchedVariants, synced_at: now },
    });

    return new Response(JSON.stringify({
      success: true,
      updated_variants: updatedVariants,
      skipped_recent: skippedRecent,
      mismatched_variants: mismatchedVariants,
      synced_at: now,
      circuit_tripped: circuitTripped,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[bling-sync-single-stock] Error:", err.message);
    return new Response(JSON.stringify({
      success: false,
      error: "sync_error",
      message: err.message,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
