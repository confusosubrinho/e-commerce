import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigAwareUpdateFields, DEFAULT_SYNC_CONFIG, getSyncConfig } from "../_shared/bling-sync-fields.ts";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";
import { fetchWithRateLimit } from "../_shared/blingFetchWithRateLimit.ts";
import { getValidTokenSafe } from "../_shared/blingTokenRefresh.ts";
import { hasRecentLocalMovements } from "../_shared/blingStockPush.ts";
import {
  auditBlingSaldosBatch,
  blingIdMissingExplicitInAudit,
  blingVariantSyncDecisionColumns,
  BlingStockCircuitBreaker,
  evaluateSkuRelinkOnProduct,
  explicitSaldoFromBlingStockRow,
  explicitSaldoFromLegacyEstoque,
  explicitSaldoFromWebhookPayload,
  logBlingSaldosBatchAudit,
  logBlingStockEvent,
  parseBlingStockCircuitConfig,
  resolveSafeStockUpdate,
  type BlingStockMatchType,
} from "../_shared/blingStockSafe.ts";
import type { BlingSyncConfig } from "../_shared/bling-sync-fields.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BLING_API_URL = "https://api.bling.com.br/Api/v3";

function createSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

const tenantIdByProductCache = new Map<string, string | null>();
async function getTenantIdByProductId(supabase: any, productId: string): Promise<string | null> {
  if (tenantIdByProductCache.has(productId)) return tenantIdByProductCache.get(productId) ?? null;
  const { data } = await supabase.from("products").select("tenant_id").eq("id", productId).maybeSingle();
  const tenantId = (data?.tenant_id as string | null) ?? null;
  tenantIdByProductCache.set(productId, tenantId);
  return tenantId;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Webhook logging ───
async function logWebhook(supabase: any, params: {
  event_type: string;
  event_id?: string;
  bling_product_id?: number | null;
  payload_meta?: any;
  result: string;
  reason?: string;
  status_code?: number;
  processing_time_ms?: number;
}) {
  try {
    await supabase.from("bling_webhook_logs").insert({
      event_type: params.event_type,
      event_id: params.event_id || null,
      bling_product_id: params.bling_product_id || null,
      payload_meta: params.payload_meta || {},
      result: params.result,
      reason: params.reason || null,
      status_code: params.status_code || 200,
      processing_time_ms: params.processing_time_ms || null,
    });
  } catch (e) {
    console.error("[webhook] Failed to log webhook:", e);
  }
}

// getSyncConfig is now imported from _shared/bling-sync-fields.ts

// Use shared token refresh with optimistic locking
async function getValidToken(supabase: any): Promise<string> {
  return getValidTokenSafe(supabase);
}

function blingHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}`, Accept: "application/json" };
}

// ─── HMAC Signature Validation ───
async function validateHmacSignature(bodyText: string, signatureHeader: string | null, clientSecret: string): Promise<boolean> {
  if (!signatureHeader || !clientSecret) return false;
  const expectedPrefix = "sha256=";
  if (!signatureHeader.startsWith(expectedPrefix)) return false;
  const providedHash = signatureHeader.slice(expectedPrefix.length);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(clientSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const computedHash = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
  return computedHash === providedHash;
}

// ─── Classify Bling V3 event ───
function classifyEvent(event: string): "stock" | "product" | "order" | "invoice" | "unknown" {
  const e = event.toLowerCase();
  if (e.includes("stock") || e.includes("estoque")) return "stock";
  if (e.includes("product") || e.includes("produto")) return "product";
  if (e.includes("order") || e.includes("pedido") || e.includes("venda")) return "order";
  if (e.includes("invoice") || e.includes("nf") || e.includes("consumer_invoice")) return "invoice";
  return "unknown";
}

// ─── Find variant by bling_variant_id OR by SKU (SKU único normalizado no produto pai) ───
async function findVariantByBlingIdOrSku(
  supabase: any,
  blingId: number,
  token?: string,
): Promise<{ variantId: string; productId: string; matchType: BlingStockMatchType } | null> {
  const { data: variant } = await supabase.from("product_variants").select("id, product_id").eq("bling_variant_id", blingId).maybeSingle();
  if (variant) return { variantId: variant.id, productId: variant.product_id, matchType: "bling_variant_id" };

  const { data: product } = await supabase.from("products").select("id").eq("bling_product_id", blingId).maybeSingle();
  if (product) {
    const { data: defaultVar } = await supabase.from("product_variants").select("id").eq("product_id", product.id).limit(1).maybeSingle();
    if (defaultVar) return { variantId: defaultVar.id, productId: product.id, matchType: "bling_product_id_parent" };
  }

  if (token) {
    try {
      const res = await fetchWithTimeout(`${BLING_API_URL}/produtos/${blingId}`, { headers: blingHeaders(token) });
      if (res.ok) {
        const json = await res.json();
        const data = json?.data;
        const sku = data?.codigo;
        const parentBlingId = data?.produtoPai?.id ?? data?.idProdutoPai ?? data?.id;
        if (sku != null && String(sku).trim() !== "" && parentBlingId != null) {
          const { data: parentProd } = await supabase.from("products").select("id").eq("bling_product_id", parentBlingId).maybeSingle();
          if (parentProd) {
            const { data: pvars } = await supabase.from("product_variants").select("id, sku").eq("product_id", parentProd.id);
            const relink = evaluateSkuRelinkOnProduct(pvars || [], String(sku));
            if (relink.ok) {
              await supabase.from("product_variants").update({ bling_variant_id: blingId }).eq("id", relink.variantId);
              console.log(`[webhook] Linked variant ${relink.variantId} to bling_id=${blingId} via SKU (produto ${parentProd.id})`);
              return { variantId: relink.variantId, productId: parentProd.id, matchType: "sku_relink" };
            }
            logBlingStockEvent("SKU relink skipped: ambiguidade ou SKU vazio no produto", "webhook.findVariantByBlingIdOrSku", {
              bling_id: blingId,
              reason: relink.reason,
              product_id: parentProd.id,
            });
          }
        }
      }
    } catch (err) {
      console.error(`[webhook] SKU fallback failed for ${blingId}:`, err);
    }
  }
  return null;
}

// ─── Update stock for a single Bling product ID + update sync status ───
// Fix 4: Check for recent local inventory movements before overwriting stock
async function updateStockForBlingId(supabase: any, blingProductId: number, newStock?: number, token?: string, depth: number = 0): Promise<string> {
  if (newStock === undefined && !token) return "no_data";

  const { data: variantMatch } = await supabase.from("product_variants").select("id, product_id").eq("bling_variant_id", blingProductId).maybeSingle();
  if (variantMatch) {
    const { data: parentProduct } = await supabase.from("products").select("is_active").eq("id", variantMatch.product_id).maybeSingle();
    if (parentProduct && parentProduct.is_active === false) {
      console.log(`[webhook] Skipping stock update for inactive product (variant bling_id=${blingProductId})`);
      return "skipped_inactive";
    }
    if (newStock !== undefined) {
      const hasRecent = await hasRecentLocalMovements(supabase, variantMatch.id, 10);
      const { data: currentVar } = await supabase.from("product_variants").select("stock_quantity").eq("id", variantMatch.id).maybeSingle();
      const oldStock = currentVar?.stock_quantity ?? 0;
      const resolved = resolveSafeStockUpdate({
        batchHttpOk: true,
        explicitSaldo: newStock,
        inPartialBatchMissingSaldo: false,
        hasRecentLocalMovement: hasRecent,
        matchType: "bling_variant_id",
        oldStock,
      });
      const meta = blingVariantSyncDecisionColumns(resolved, "webhook.updateStockForBlingId");
      if (resolved.shouldApplyStock && resolved.new_stock !== undefined) {
        await supabase.from("product_variants").update({ stock_quantity: resolved.new_stock, ...meta }).eq("id", variantMatch.id);
        if (resolved.new_stock !== oldStock) {
          const tenantId = await getTenantIdByProductId(supabase, variantMatch.product_id);
          if (!tenantId) {
            console.warn("[bling-webhook] Missing tenant_id for inventory_movements insert", {
              product_id: variantMatch.product_id,
              variant_id: variantMatch.id,
            });
          } else {
            await supabase.from("inventory_movements").insert({
              tenant_id: tenantId,
              variant_id: variantMatch.id,
              quantity: resolved.new_stock - oldStock,
              type: "bling_sync",
            }).then(() => {}).catch(() => {});
          }
        }
      } else {
        await supabase.from("product_variants").update(meta).eq("id", variantMatch.id);
        if (hasRecent) {
          console.log(`[webhook] Skipping stock overwrite for variant ${variantMatch.id} (bling_id=${blingProductId}) — recent local movements detected`);
          return "skipped_recent_movement";
        }
      }
      await supabase.from("products").update({
        bling_sync_status: "synced",
        bling_last_synced_at: new Date().toISOString(),
        bling_last_error: null,
      }).eq("id", variantMatch.product_id);
      console.log(`[webhook] Stock updated (variant): bling_variant_id=${blingProductId} → ${newStock}`);
    }
    return "updated";
  }

  const { data: product } = await supabase.from("products").select("id, is_active").eq("bling_product_id", blingProductId).maybeSingle();
  if (product) {
    if (product.is_active === false) {
      console.log(`[webhook] Skipping stock update for inactive product (bling_id=${blingProductId})`);
      return "skipped_inactive";
    }
    const { data: variants } = await supabase.from("product_variants").select("id").eq("product_id", product.id);
    const variantCount = variants?.length ?? 0;
    if (variantCount > 1) {
      if (!token) return "no_token";
      try {
        const res = await fetchWithTimeout(`${BLING_API_URL}/produtos/${blingProductId}`, { headers: blingHeaders(token) });
        if (!res.ok) return "error";
        const json = await res.json();
        const detail = json?.data;
        if (detail) {
          await syncStockOnly(supabase, blingHeaders(token), product.id, blingProductId, detail);
          console.log(`[webhook] Stock updated (product multi-variant): bling_id=${blingProductId} → synced all variants`);
          return "updated";
        }
      } catch (err) {
        console.error(`[webhook] Error syncing stock for product ${blingProductId}:`, err);
        return "error";
      }
    }
    if (variantCount === 1 && newStock !== undefined) {
      const singleVariantId = variants[0].id;
      const hasRecent = await hasRecentLocalMovements(supabase, singleVariantId, 10);
      const { data: oldSingleVar } = await supabase.from("product_variants").select("stock_quantity").eq("id", singleVariantId).maybeSingle();
      const oldSingleStock = oldSingleVar?.stock_quantity ?? 0;
      const resolvedSingle = resolveSafeStockUpdate({
        batchHttpOk: true,
        explicitSaldo: newStock,
        inPartialBatchMissingSaldo: false,
        hasRecentLocalMovement: hasRecent,
        matchType: "bling_product_id_parent",
        oldStock: oldSingleStock,
      });
      const metaSingle = blingVariantSyncDecisionColumns(resolvedSingle, "webhook.updateStockForBlingId.single");
      if (resolvedSingle.shouldApplyStock && resolvedSingle.new_stock !== undefined) {
        await supabase.from("product_variants").update({ stock_quantity: resolvedSingle.new_stock, ...metaSingle }).eq("id", singleVariantId);
        if (resolvedSingle.new_stock !== oldSingleStock) {
          const tenantId = await getTenantIdByProductId(supabase, product.id);
          if (!tenantId) {
            console.warn("[bling-webhook] Missing tenant_id for inventory_movements insert", {
              product_id: product.id,
              variant_id: singleVariantId,
            });
          } else {
            await supabase.from("inventory_movements").insert({
              tenant_id: tenantId,
              variant_id: singleVariantId,
              quantity: resolvedSingle.new_stock - oldSingleStock,
              type: "bling_sync",
            }).then(() => {}).catch(() => {});
          }
        }
      } else {
        await supabase.from("product_variants").update(metaSingle).eq("id", singleVariantId);
        if (hasRecent) {
          console.log(`[webhook] Skipping stock overwrite for single-variant product (bling_id=${blingProductId}) — recent local movements detected`);
          return "skipped_recent_movement";
        }
      }
      await supabase.from("products").update({
        bling_sync_status: "synced",
        bling_last_synced_at: new Date().toISOString(),
        bling_last_error: null,
      }).eq("id", product.id);
      console.log(`[webhook] Stock updated (product single variant): bling_id=${blingProductId} → ${newStock}`);
      return "updated";
    }
  }

  // SKU fallback (produto pai + SKU normalizado único)
  if (token) {
    try {
      const res = await fetchWithTimeout(`${BLING_API_URL}/produtos/${blingProductId}`, { headers: blingHeaders(token) });
      if (res.ok) {
        const json = await res.json();
        const data = json?.data;
        const sku = data?.codigo;
        const parentBlingId = data?.produtoPai?.id ?? data?.idProdutoPai ?? data?.id;
        if (sku != null && String(sku).trim() !== "" && parentBlingId != null) {
          const { data: parentProd } = await supabase.from("products").select("id").eq("bling_product_id", parentBlingId).maybeSingle();
          if (parentProd) {
            const { data: pvars } = await supabase.from("product_variants").select("id, sku").eq("product_id", parentProd.id);
            const relink = evaluateSkuRelinkOnProduct(pvars || [], String(sku));
            if (relink.ok) {
              await supabase.from("product_variants").update({ bling_variant_id: blingProductId }).eq("id", relink.variantId);
              if (newStock !== undefined) {
                const hasRecent = await hasRecentLocalMovements(supabase, relink.variantId, 10);
                const { data: curSku } = await supabase.from("product_variants").select("stock_quantity").eq("id", relink.variantId).maybeSingle();
                const oldSkuStock = curSku?.stock_quantity ?? 0;
                const resolvedSku = resolveSafeStockUpdate({
                  batchHttpOk: true,
                  explicitSaldo: newStock,
                  inPartialBatchMissingSaldo: false,
                  hasRecentLocalMovement: hasRecent,
                  matchType: "sku_relink",
                  oldStock: oldSkuStock,
                });
                const metaSku = blingVariantSyncDecisionColumns(resolvedSku, "webhook.updateStockForBlingId.sku_fallback");
                if (resolvedSku.shouldApplyStock && resolvedSku.new_stock !== undefined) {
                  await supabase.from("product_variants").update({ stock_quantity: resolvedSku.new_stock, ...metaSku }).eq("id", relink.variantId);
                  if (resolvedSku.new_stock !== oldSkuStock) {
                    const tenantId = await getTenantIdByProductId(supabase, parentProd.id);
                    if (tenantId) {
                      await supabase.from("inventory_movements").insert({
                        tenant_id: tenantId,
                        variant_id: relink.variantId,
                        quantity: resolvedSku.new_stock - oldSkuStock,
                        type: "bling_sync",
                      }).then(() => {}).catch(() => {});
                    }
                  }
                } else {
                  await supabase.from("product_variants").update(metaSku).eq("id", relink.variantId);
                  if (hasRecent) console.log(`[webhook] Skipping SKU fallback stock overwrite for variant ${relink.variantId} — recent local movements`);
                }
                await supabase.from("products").update({
                  bling_sync_status: "synced",
                  bling_last_synced_at: new Date().toISOString(),
                  bling_last_error: null,
                }).eq("id", parentProd.id);
              }
              console.log(`[webhook] Linked and updated variant via SKU: bling_id=${blingProductId} → ${newStock}`);
              return "updated";
            }
            logBlingStockEvent("SKU fallback relink skipped", "webhook.updateStockForBlingId", {
              bling_product_id: blingProductId,
              reason: relink.reason,
              product_id: parentProd.id,
            });
          }
        }
      }
    } catch (err) {
      console.error(`[webhook] SKU fallback failed for ${blingProductId}:`, err);
    }
  }

  if (newStock === undefined && token) {
    if (depth >= 1) {
      console.log(`[webhook] Max recursion depth reached for bling_id=${blingProductId}, skipping stock fetch`);
      return "max_depth";
    }
    try {
      const res = await fetchWithTimeout(`${BLING_API_URL}/estoques/saldos?idsProdutos[]=${blingProductId}`, { headers: blingHeaders(token) });
      if (!res.ok) {
        const t = await res.text();
        logBlingStockEvent("Bling stock fetch failed (HTTP), preserving local stock", "webhook.updateStockForBlingId.fetch", {
          bling_product_id: blingProductId,
          status: res.status,
          body: t.substring(0, 200),
        });
        return "no_stock_data";
      }
      const json = await res.json();
      const row = json?.data?.[0];
      const stock = row != null && (row as { produto?: { id?: number } }).produto?.id === blingProductId
        ? explicitSaldoFromBlingStockRow(row)
        : undefined;
      if (stock !== undefined) {
        return await updateStockForBlingId(supabase, blingProductId, stock, token, depth + 1);
      }
      logBlingStockEvent("Bling stock skipped: no explicit saldo for requested product id", "webhook.updateStockForBlingId.fetch", {
        bling_product_id: blingProductId,
      });
    } catch (err) {
      console.error(`[webhook] Error fetching stock for ${blingProductId}:`, err);
    }
    return "no_stock_data";
  }

  console.log(`[webhook] No match found for bling_id=${blingProductId}`);
  return "not_found";
}

// ─── Sync a single product — config-aware, never changes is_active ───
async function syncSingleProduct(supabase: any, blingProductId: number, token: string, config: BlingSyncConfig) {
  const headers = blingHeaders(token);

  try {
    const actualParentId = blingProductId;

    // Check if product exists and is active
    let existing = await supabase.from("products").select("id, is_active").eq("bling_product_id", actualParentId).maybeSingle().then((r: any) => r.data);

    if (!existing) {
      // Try to resolve via parent
      const res = await fetchWithTimeout(`${BLING_API_URL}/produtos/${blingProductId}`, { headers });
      if (!res.ok) { console.error(`[webhook] Product detail fetch failed for ${blingProductId}: ${res.status}`); return; }
      const json = await res.json();
      const detail = json?.data;
      if (!detail) return;

      const resolvedParentId = detail.produtoPai?.id || detail.idProdutoPai || blingProductId;
      const { data: parentExisting } = await supabase.from("products").select("id, is_active").eq("bling_product_id", resolvedParentId).maybeSingle();

      if (!parentExisting) { console.log(`[webhook] Product ${resolvedParentId} not in DB, skipping`); return; }
      if (parentExisting.is_active === false) { console.log(`[webhook] Product ${resolvedParentId} is inactive, skipping sync`); return; }

      // Config-aware update for resolved parent
      await syncProductFields(supabase, headers, parentExisting.id, resolvedParentId, detail, config);
      return;
    }

    // CRITICAL: Skip inactive products entirely
    if (existing.is_active === false) {
      console.log(`[webhook] Product ${actualParentId} is inactive, skipping sync`);
      return;
    }

    // Fetch detail
    const res = await fetchWithTimeout(`${BLING_API_URL}/produtos/${blingProductId}`, { headers });
    if (!res.ok) { console.error(`[webhook] Product detail fetch failed for ${blingProductId}: ${res.status}`); return; }
    const json = await res.json();
    const detail = json?.data;
    if (!detail) return;

    // Config-aware sync
    await syncProductFields(supabase, headers, existing.id, actualParentId, detail, config);
    console.log(`[webhook] Product ${actualParentId} synced successfully (config-aware)`);
  } catch (err: any) {
    console.error(`[webhook] Error syncing product ${blingProductId}:`, err.message);
  }
}

// ─── Sync product fields + stock based on config ───
async function syncProductFields(supabase: any, headers: any, productId: string, blingProductId: number, detail: any, config: BlingSyncConfig) {
  // Update config-enabled fields (NEVER touch is_active)
  const updateData = getConfigAwareUpdateFields(detail, config);
  await supabase.from("products").update({
    ...updateData,
    bling_last_synced_at: new Date().toISOString(),
    bling_sync_status: "synced",
    bling_last_error: null,
  }).eq("id", productId);

  // Bug 4 Fix: Re-upload images to storage instead of using raw Bling URLs (which expire)
  if (config.sync_images && detail.midia?.imagens?.internas?.length) {
    await supabase.from("product_images").delete().eq("product_id", productId);
    const images: any[] = [];
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    for (let idx = 0; idx < detail.midia.imagens.internas.length; idx++) {
      const img = detail.midia.imagens.internas[idx];
      let finalUrl = img.link;
      try {
        // Skip if already a Supabase URL without expiration
        if (finalUrl.includes(supabaseUrl) && !finalUrl.includes("Expires=")) {
          // Already in storage, use as-is
        } else {
          // Download and re-upload to storage
          const response = await fetchWithTimeout(finalUrl);
          if (response.ok) {
            const blob = await response.blob();
            const contentType = response.headers.get("content-type") || "image/jpeg";
            const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
            const fileName = `bling/${productId}/${idx}-${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from("product-media")
              .upload(fileName, blob, { contentType, upsert: true });
            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from("product-media")
                .getPublicUrl(fileName);
              finalUrl = publicUrl;
            } else {
              console.warn(`[webhook] Image upload failed: ${uploadError.message}`);
              finalUrl = finalUrl.split("?")[0]; // Strip query params as fallback
            }
          } else {
            finalUrl = finalUrl.split("?")[0];
          }
        }
      } catch (err: any) {
        console.warn(`[webhook] Image re-upload error: ${err.message}`);
        finalUrl = finalUrl.split("?")[0];
      }
      images.push({
        product_id: productId, url: finalUrl, is_primary: idx === 0, display_order: idx, alt_text: detail.nome,
      });
    }
    if (images.length > 0) {
      await supabase.from("product_images").insert(images);
    }
  }

  // Sync stock (always if sync_stock is on)
  if (config.sync_stock) {
    await syncStockOnly(supabase, headers, productId, blingProductId, detail);
  }
}

// ─── Sync ONLY stock for an existing product ───
async function syncStockOnly(supabase: any, headers: any, productId: string, blingProductId: number, detail: any) {
  let stockUpdated = false;
  if (detail.variacoes?.length) {
    const varIds = detail.variacoes.map((v: any) => v.id);
    // Batch IDs in groups of 50 to avoid URL length limits (Error 414)
    const BATCH_SIZE = 50;
    const allStockData: any[] = [];
    let anyVarBatchFailed = false;
    for (let i = 0; i < varIds.length; i += BATCH_SIZE) {
      const batch = varIds.slice(i, i + BATCH_SIZE);
      const idsParam = batch.map((id: number) => `idsProdutos[]=${id}`).join("&");
      await sleep(300);
      const stockRes = await fetchWithTimeout(`${BLING_API_URL}/estoques/saldos?${idsParam}`, { headers });
      if (!stockRes.ok) {
        const t = await stockRes.text();
        anyVarBatchFailed = true;
        logBlingStockEvent("Bling batch stock request failed, no overwrite from this batch", "webhook.syncStockOnly.variacoes", {
          product_id: productId,
          bling_product_id: blingProductId,
          status: stockRes.status,
          body: t.substring(0, 200),
        });
        continue;
      }
      const stockJson = await stockRes.json();
      const dataRows = stockJson?.data || [];
      const batchAudit = auditBlingSaldosBatch(batch, dataRows);
      logBlingSaldosBatchAudit(batchAudit, "webhook.syncStockOnly.variacoes.batch", {
        product_id: productId,
        bling_product_id: blingProductId,
        batch_offset: i,
      });
      allStockData.push(...dataRows);
    }
    const saldoById = new Map<number, number>();
    for (const s of allStockData) {
      const pid = s?.produto?.id;
      const q = explicitSaldoFromBlingStockRow(s);
      if (pid != null && typeof pid === "number" && q !== undefined) saldoById.set(pid, q);
    }
    for (const vid of varIds) {
      if (!saldoById.has(vid)) {
        logBlingStockEvent("Bling stock partial: variation id without explicit saldo in merged response", "webhook.syncStockOnly", {
          product_id: productId,
          bling_variant_id: vid,
        });
      }
    }
    const tokenFromHeaders = (headers as any)?.Authorization?.replace("Bearer ", "") || undefined;
    for (const [varBlingId, qty] of saldoById) {
      const match = await findVariantByBlingIdOrSku(supabase, varBlingId, tokenFromHeaders);
      if (match) {
        const hasRecent = await hasRecentLocalMovements(supabase, match.variantId, 10);
        const { data: oldVar } = await supabase.from("product_variants").select("stock_quantity").eq("id", match.variantId).maybeSingle();
        const oldQty = oldVar?.stock_quantity ?? 0;
        const resolved = resolveSafeStockUpdate({
          batchHttpOk: !anyVarBatchFailed,
          explicitSaldo: qty,
          inPartialBatchMissingSaldo: false,
          hasRecentLocalMovement: hasRecent,
          matchType: match.matchType,
          oldStock: oldQty,
        });
        const meta = blingVariantSyncDecisionColumns(resolved, "webhook.syncStockOnly.variacoes");
        if (resolved.shouldApplyStock && resolved.new_stock !== undefined) {
          await supabase.from("product_variants").update({ stock_quantity: resolved.new_stock, ...meta }).eq("id", match.variantId);
          stockUpdated = true;
          if (resolved.new_stock !== oldQty) {
            const tenantId = await getTenantIdByProductId(supabase, match.productId);
            if (!tenantId) {
              console.warn("[bling-webhook] Missing tenant_id for inventory_movements insert", {
                product_id: match.productId,
                variant_id: match.variantId,
              });
            } else {
              await supabase.from("inventory_movements").insert({
                tenant_id: tenantId,
                variant_id: match.variantId,
                quantity: resolved.new_stock - oldQty,
                type: "bling_sync",
              }).then(() => {}).catch(() => {});
            }
          }
        } else {
          await supabase.from("product_variants").update(meta).eq("id", match.variantId);
          if (hasRecent) {
            console.log(`[webhook] Skipping stock overwrite in syncStockOnly for variant ${match.variantId} — recent local movements`);
          }
        }
      } else {
        logBlingStockEvent("Bling variant not found by ID or SKU, preserving local stock", "webhook.syncStockOnly", {
          product_id: productId,
          bling_variant_id: varBlingId,
        });
      }
    }
  } else {
    await sleep(300);
    const stockRes = await fetchWithTimeout(`${BLING_API_URL}/estoques/saldos?idsProdutos[]=${blingProductId}`, { headers });
    if (!stockRes.ok) {
      const t = await stockRes.text();
      logBlingStockEvent("Bling stock request failed for simple product, preserving local stock", "webhook.syncStockOnly.simple", {
        product_id: productId,
        bling_product_id: blingProductId,
        status: stockRes.status,
        body: t.substring(0, 200),
      });
      return;
    }
    const stockJson = await stockRes.json();
    const row0 = stockJson?.data?.[0];
    const qty =
      row0 != null && row0.produto?.id === blingProductId
        ? explicitSaldoFromBlingStockRow(row0)
        : undefined;
    if (qty === undefined) {
      logBlingStockEvent("Bling stock skipped: no explicit saldo for simple product", "webhook.syncStockOnly.simple", {
        product_id: productId,
        bling_product_id: blingProductId,
      });
      return;
    }
    // Check recent local movements for all variants of this product
    const { data: prodVariants } = await supabase.from("product_variants").select("id").eq("product_id", productId);
    let skipAll = false;
    for (const pv of (prodVariants || [])) {
      if (await hasRecentLocalMovements(supabase, pv.id, 10)) { skipAll = true; break; }
    }
    if (skipAll) {
      console.log(`[webhook] Skipping stock overwrite in syncStockOnly no-variation for product ${productId} — recent local movements`);
    } else {
      for (const pv of (prodVariants || [])) {
        const { data: oldVar } = await supabase.from("product_variants").select("stock_quantity").eq("id", pv.id).maybeSingle();
        const oldQty = oldVar?.stock_quantity ?? 0;
        const resolved = resolveSafeStockUpdate({
          batchHttpOk: true,
          explicitSaldo: qty,
          inPartialBatchMissingSaldo: false,
          hasRecentLocalMovement: false,
          matchType: "bling_product_id_parent",
          oldStock: oldQty,
        });
        const meta = blingVariantSyncDecisionColumns(resolved, "webhook.syncStockOnly.simple");
        if (resolved.shouldApplyStock && resolved.new_stock !== undefined) {
          await supabase.from("product_variants").update({ stock_quantity: resolved.new_stock, ...meta }).eq("id", pv.id);
          stockUpdated = true;
          if (resolved.new_stock !== oldQty) {
            const tenantId = await getTenantIdByProductId(supabase, productId);
            if (!tenantId) {
              console.warn("[bling-webhook] Missing tenant_id for inventory_movements insert", {
                product_id: productId,
                variant_id: pv.id,
              });
            } else {
              await supabase.from("inventory_movements").insert({
                tenant_id: tenantId,
                variant_id: pv.id,
                quantity: resolved.new_stock - oldQty,
                type: "bling_sync",
              }).then(() => {}).catch(() => {});
            }
          }
        } else {
          await supabase.from("product_variants").update(meta).eq("id", pv.id);
        }
      }
    }
  }

  if (stockUpdated) {
    await supabase.from("products").update({
      bling_sync_status: "synced",
      bling_last_synced_at: new Date().toISOString(),
      bling_last_error: null,
    }).eq("id", productId);
  }
}

// ─── Batch stock sync (cron) — only active products, updates sync status ───
async function batchStockSync(supabase: any) {
  const runStarted = new Date().toISOString();
  const correlationId = crypto.randomUUID();
  
  // Check if sync_stock is enabled
  const config = await getSyncConfig(supabase);
  if (!config.sync_stock) {
    console.log("[cron] sync_stock is disabled, skipping batch sync");
    await supabase.from("bling_sync_runs").insert({
      started_at: runStarted, finished_at: new Date().toISOString(),
      trigger_type: "cron", processed_count: 0, updated_count: 0, errors_count: 0,
      error_details: [{ correlation_id: correlationId, reason: "sync_stock disabled" }],
    });
    return { updated: 0, message: "sync_stock disabled" };
  }

  let token: string;
  try { token = await getValidToken(supabase); } catch (err: any) {
    console.error("[cron] Cannot get valid token:", err.message);
    await supabase.from("bling_sync_runs").insert({
      started_at: runStarted, finished_at: new Date().toISOString(),
      trigger_type: "cron", processed_count: 0, updated_count: 0, errors_count: 1,
      error_details: [{ correlation_id: correlationId, reason: `Token error: ${err.message}` }],
    });
    return { error: err.message, updated: 0 };
  }
  const headers = blingHeaders(token);

  const { data: allVariants } = await supabase.from("product_variants").select("id, bling_variant_id, product_id, sku");
  const { data: products } = await supabase.from("products").select("id, bling_product_id, is_active").not("bling_product_id", "is", null);

  const activeProductIds = new Set<string>();
  const productBlingMap = new Map<string, number>();
  for (const p of (products || [])) {
    if (p.is_active === false) continue; // Skip inactive
    activeProductIds.add(p.id);
    productBlingMap.set(p.id, p.bling_product_id);
  }

  const blingIdToVariants = new Map<number, string[]>();
  // Track which product_id each bling_id belongs to for sync status update
  const blingIdToProductId = new Map<number, string>();
  
  for (const v of (allVariants || [])) {
    if (!activeProductIds.has(v.product_id)) continue;
    if (v.bling_variant_id) {
      if (!blingIdToVariants.has(v.bling_variant_id)) blingIdToVariants.set(v.bling_variant_id, []);
      blingIdToVariants.get(v.bling_variant_id)!.push(v.id);
      blingIdToProductId.set(v.bling_variant_id, v.product_id);
    } else {
      const parentBlingId = productBlingMap.get(v.product_id);
      if (parentBlingId) {
        if (!blingIdToVariants.has(parentBlingId)) blingIdToVariants.set(parentBlingId, []);
        blingIdToVariants.get(parentBlingId)!.push(v.id);
        blingIdToProductId.set(parentBlingId, v.product_id);
      }
    }
  }

  const allBlingIds = [...blingIdToVariants.keys()];
  if (allBlingIds.length === 0) {
    await supabase.from("bling_sync_runs").insert({
      started_at: runStarted, finished_at: new Date().toISOString(),
      trigger_type: "cron", processed_count: 0, updated_count: 0, errors_count: 0,
      error_details: [{ correlation_id: correlationId, reason: "no bling ids to sync" }],
    });
    return { updated: 0 };
  }

  let updated = 0;
  let errorsCount = 0;
  const errorDetails: any[] = [];
  const updatedProductIds = new Set<string>();
  const cronStartTime = Date.now();
  const TIMEOUT_SAFETY_MS = 50_000; // Stop at 50s to allow cleanup before edge function timeout
  let timedOut = false;
  const circuit = new BlingStockCircuitBreaker(parseBlingStockCircuitConfig({
    BLING_STOCK_CIRCUIT_MISSING_SALDO_PERCENT: Deno.env.get("BLING_STOCK_CIRCUIT_MISSING_SALDO_PERCENT") ?? undefined,
    BLING_STOCK_CIRCUIT_MAX_ZERO_UPDATES: Deno.env.get("BLING_STOCK_CIRCUIT_MAX_ZERO_UPDATES") ?? undefined,
    BLING_STOCK_CIRCUIT_MIN_REQUESTED_FOR_PERCENT: Deno.env.get("BLING_STOCK_CIRCUIT_MIN_REQUESTED_FOR_PERCENT") ?? undefined,
  }));
  let circuitTripped = false;
  let circuitTripReason: string | undefined;

  outerCron: for (let i = 0; i < allBlingIds.length; i += 50) {
    // Timeout guard: stop if we're close to the edge function limit
    if (Date.now() - cronStartTime > TIMEOUT_SAFETY_MS) {
      timedOut = true;
      console.warn(`[cron] Timeout guard: stopping after ${i} IDs (${allBlingIds.length} total). ${allBlingIds.length - i} pending.`);
      errorDetails.push({ reason: `timeout_guard`, processed: i, total: allBlingIds.length, pending: allBlingIds.length - i });
      break;
    }

    const batch = allBlingIds.slice(i, i + 50);
    const idsParam = batch.map(id => `idsProdutos[]=${id}`).join("&");
    try {
      if (i > 0) await sleep(350);
      const res = await fetchWithTimeout(`${BLING_API_URL}/estoques/saldos?${idsParam}`, { headers });
      const json = await res.json();
      if (!res.ok) {
        console.error(`[cron] Stock batch error:`, JSON.stringify(json));
        errorsCount++;
        errorDetails.push({ batch_start: i, error: JSON.stringify(json).substring(0, 200), correlation_id: correlationId });
        continue;
      }
      const batchRows = json?.data || [];
      const batchAudit = auditBlingSaldosBatch(batch, batchRows);
      logBlingSaldosBatchAudit(batchAudit, "webhook.batchStockSync", {
        correlation_id: correlationId,
        batch_start_index: i,
      });
      circuit.recordBatchAudit(batchAudit);
      const evBatch = circuit.evaluateAfterBatch();
      if (evBatch.tripped) {
        circuitTripped = true;
        circuitTripReason = evBatch.reason;
        errorDetails.push({ correlation_id: correlationId, circuit_breaker: evBatch.reason, batch_start: i });
        console.warn(JSON.stringify({
          level: "warn",
          message: "webhook.batchStockSync circuit breaker tripped (missing saldo ratio)",
          correlation_id: correlationId,
          reason: evBatch.reason,
          cumulative_requested: circuit.cumulativeRequested,
          cumulative_missing_explicit: circuit.cumulativeMissingExplicit,
        }));
        break outerCron;
      }
      for (const stock of batchRows) {
        const blingId = stock.produto?.id;
        if (!blingId || typeof blingId !== "number") continue;
        const qty = explicitSaldoFromBlingStockRow(stock);
        const variantIds = blingIdToVariants.get(blingId);
        if (!variantIds) continue;
        const missingPartial = blingIdMissingExplicitInAudit(batchAudit, blingId);
        const pid = blingIdToProductId.get(blingId);
        const tenantId = pid ? await getTenantIdByProductId(supabase, pid) : null;
        for (const vid of variantIds) {
          const hasRecent = await hasRecentLocalMovements(supabase, vid, 10);
          const { data: currentVar } = await supabase.from("product_variants").select("stock_quantity").eq("id", vid).maybeSingle();
          const oldStock = currentVar?.stock_quantity ?? 0;
          const resolved = resolveSafeStockUpdate({
            batchHttpOk: true,
            explicitSaldo: qty,
            inPartialBatchMissingSaldo: missingPartial && qty === undefined,
            hasRecentLocalMovement: hasRecent,
            matchType: "bling_variant_id",
            oldStock,
          });
          const meta = blingVariantSyncDecisionColumns(resolved, "webhook.batchStockSync");
          if (resolved.shouldApplyStock && resolved.new_stock !== undefined) {
            await supabase.from("product_variants").update({ stock_quantity: resolved.new_stock, ...meta }).eq("id", vid);
            circuit.recordAppliedStockUpdate(oldStock, resolved.new_stock);
            const evZero = circuit.evaluateAfterBatch();
            if (evZero.tripped) {
              circuitTripped = true;
              circuitTripReason = evZero.reason;
              errorDetails.push({ correlation_id: correlationId, circuit_breaker: evZero.reason, batch_start: i });
              console.warn(JSON.stringify({
                level: "warn",
                message: "webhook.batchStockSync circuit breaker tripped (zero updates)",
                correlation_id: correlationId,
                reason: evZero.reason,
                zero_stock_updates: circuit.zeroStockUpdates,
              }));
              break outerCron;
            }
            if (resolved.new_stock !== oldStock) {
              if (!tenantId) {
                console.warn("[bling-webhook] Missing tenant_id for inventory_movements insert", {
                  product_id: pid,
                  variant_id: vid,
                });
              } else {
                await supabase.from("inventory_movements").insert({
                  tenant_id: tenantId,
                  variant_id: vid,
                  quantity: resolved.new_stock - oldStock,
                  type: "bling_sync",
                }).then(() => {}).catch(() => {});
              }
            }
            updated++;
          } else {
            await supabase.from("product_variants").update(meta).eq("id", vid);
            if (qty === undefined) {
              logBlingStockEvent("Bling stock skipped: missing explicit saldoVirtualTotal in cron batch", "webhook.batchStockSync", {
                bling_produto_id: blingId,
                decision: resolved.decision,
              });
            } else if (hasRecent) {
              console.log(`[cron] Skipping stock overwrite for variant ${vid} (bling_id=${blingId}) — recent local movements`);
            }
          }
        }
        if (pid) updatedProductIds.add(pid);
      }
    } catch (err: any) {
      console.error(`[cron] Stock batch fetch error:`, err.message);
      errorsCount++;
      errorDetails.push({ batch_start: i, error: err.message, correlation_id: correlationId });
    }
  }

  // Improvement 2: Mark ALL checked products as synced (not just those with stock changes)
  // This clears "error" status for products that were successfully checked
  const allCheckedProductIds = new Set<string>(updatedProductIds);
  for (const blingId of allBlingIds) {
    const pid = blingIdToProductId.get(blingId);
    if (pid) allCheckedProductIds.add(pid);
  }

  const now = new Date().toISOString();
  const productIdsArr = [...allCheckedProductIds];
  let batch: string[] = [];
  for (let i = 0; i < productIdsArr.length; i++) {
    batch.push(productIdsArr[i]);
    if (batch.length === 100 || i === productIdsArr.length - 1) {
      await supabase.from("products").update({
        bling_sync_status: "synced",
        bling_last_synced_at: now,
        bling_last_error: null,
      }).in("id", batch);
      batch = [];
    }
  }

  // ─── Retry failed webhook events (up to 3 retries) ───
  try {
    const { data: failedEvents } = await supabase
      .from("bling_webhook_events")
      .select("id, bling_product_id, retries")
      .eq("status", "failed")
      .lt("retries", 3)
      .order("created_at", { ascending: true })
      .limit(20);

    if (failedEvents?.length) {
      console.log(`[cron] Retrying ${failedEvents.length} failed webhook events`);
      for (const evt of failedEvents) {
        try {
          if (evt.bling_product_id) {
            const retryResult = await updateStockForBlingId(supabase, evt.bling_product_id, undefined, token);
            if (retryResult === "updated" || retryResult === "skipped_recent_movement") {
              await supabase.from("bling_webhook_events").update({
                status: "processed", processed_at: new Date().toISOString(), retries: evt.retries + 1,
              }).eq("id", evt.id);
            } else {
              await supabase.from("bling_webhook_events").update({
                retries: evt.retries + 1, last_error: `Retry result: ${retryResult}`,
              }).eq("id", evt.id);
            }
          }
        } catch (retryErr: any) {
          await supabase.from("bling_webhook_events").update({
            retries: evt.retries + 1, last_error: retryErr.message?.substring(0, 500),
          }).eq("id", evt.id);
        }
      }
    }
  } catch (retryBatchErr: any) {
    console.error("[cron] Failed event retry error:", retryBatchErr.message);
  }

  // Log the run
  await supabase.from("bling_sync_runs").insert({
    started_at: runStarted,
    finished_at: now,
    trigger_type: "cron",
    processed_count: allBlingIds.length,
    updated_count: updated,
    errors_count: errorsCount,
    error_details: [{
      correlation_id: correlationId,
      timed_out: timedOut,
      circuit_tripped: circuitTripped,
      circuit_trip_reason: circuitTripReason ?? null,
    }, ...errorDetails],
  });

  console.log(`[cron] Stock sync complete: ${updated} updates, ${allBlingIds.length} Bling IDs checked, ${updatedProductIds.size} products marked synced (inactive skipped)`);
  return { updated, totalChecked: allBlingIds.length, productsSynced: updatedProductIds.size };
}

// ─── Idempotency ───
async function checkAndStoreEvent(supabase: any, eventId: string, eventType: string, blingProductId: number | null, payload: any): Promise<boolean> {
  if (!eventId) return true;
  const { error } = await supabase.from("bling_webhook_events").insert({
    event_id: eventId, event_type: eventType, bling_product_id: blingProductId, payload, status: "processing",
  });
  if (error) {
    if (error.code === "23505") { console.log(`[webhook] Duplicate event ${eventId}, skipping`); return false; }
    console.error(`[webhook] Error storing event:`, error.message);
  }
  return true;
}

async function markEventProcessed(supabase: any, eventId: string, error?: string) {
  if (!eventId) return;
  await supabase.from("bling_webhook_events").update({
    processed_at: new Date().toISOString(),
    status: error ? "failed" : "processed",
    last_error: error || null,
  }).eq("event_id", eventId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createSupabase();
    const url = new URL(req.url);
    const bodyText = await req.text();

    const isCronViaParam = url.searchParams.get("action") === "cron_stock_sync";
    let payload: any = {};
    try { payload = JSON.parse(bodyText); } catch (_) {}
    const isCronViaBody = payload?.action === "cron_stock_sync";

    if (isCronViaParam || isCronViaBody) {
      const cronSecret = Deno.env.get("BLING_CRON_SECRET");
      if (cronSecret) {
        const providedSecret = url.searchParams.get("secret") ?? payload?.secret ?? "";
        if (providedSecret !== cronSecret) {
          console.warn("[cron] Unauthorized: missing or invalid secret");
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      console.log("[cron] Starting periodic stock sync...");
      const result = await batchStockSync(supabase);
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── HMAC Signature Validation ───
    const signatureHeader = req.headers.get("X-Bling-Signature-256") || req.headers.get("x-bling-signature-256");
    if (signatureHeader) {
      const { data: settings } = await supabase.from("store_settings").select("bling_client_secret").limit(1).maybeSingle();
      if (settings?.bling_client_secret) {
        const isValid = await validateHmacSignature(bodyText, signatureHeader, settings.bling_client_secret);
        if (!isValid) {
          console.error("[webhook] Invalid HMAC signature - rejecting");
          await logWebhook(supabase, {
            event_type: "signature_invalid",
            result: "error",
            reason: "Invalid HMAC signature",
            status_code: 401,
            processing_time_ms: Date.now() - startTime,
          });
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.log("[webhook] HMAC signature valid ✓");
      }
    }

    console.log("[webhook] Received:", JSON.stringify(payload).substring(0, 500));

    // Load sync config once for this request
    const config = await getSyncConfig(supabase);

    const evento = payload?.event || payload?.evento;
    const dados = payload?.data || payload?.dados;
    const eventId = payload?.eventId;
    const retorno = payload?.retorno;

    // ─── Handle legacy callback format ───
    if (retorno) {
      let token: string | null = null;
      try { token = await getValidToken(supabase); } catch (_) {}

      if (retorno.estoques && config.sync_stock) {
        const estoques = Array.isArray(retorno.estoques) ? retorno.estoques : [retorno.estoques];
        let updatedCount = 0;
        let skippedCount = 0;
        for (const estoque of estoques) {
          const est = estoque.estoque || estoque;
          const blingId = est.idProduto || est.produto?.id;
          const saldo = explicitSaldoFromLegacyEstoque(est);
          if (blingId) {
            const result = await updateStockForBlingId(supabase, blingId, saldo, token || undefined);
            if (result === "updated") updatedCount++;
            else skippedCount++;
          }
        }
        console.log(`[webhook] Processed ${estoques.length} stock callback(s): ${updatedCount} updated, ${skippedCount} skipped`);
        await logWebhook(supabase, {
          event_type: "legacy_stock",
          payload_meta: { count: estoques.length, updated: updatedCount, skipped: skippedCount },
          result: updatedCount > 0 ? "updated" : "skipped",
          reason: `${updatedCount} updated, ${skippedCount} skipped`,
          processing_time_ms: Date.now() - startTime,
        });
      } else if (retorno.estoques && !config.sync_stock) {
        console.log("[webhook] sync_stock disabled, ignoring stock callback");
        await logWebhook(supabase, {
          event_type: "legacy_stock",
          result: "skipped",
          reason: "sync_stock disabled",
          processing_time_ms: Date.now() - startTime,
        });
      }

      if (retorno.produtos && token) {
        const produtos = Array.isArray(retorno.produtos) ? retorno.produtos : [retorno.produtos];
        for (const prod of produtos) {
          const p = prod.produto || prod;
          const blingId = p.id || p.idProduto;
          if (blingId) await syncSingleProduct(supabase, blingId, token, config);
        }
        console.log(`[webhook] Processed ${produtos.length} product callback(s)`);
        await logWebhook(supabase, {
          event_type: "legacy_product",
          payload_meta: { count: produtos.length },
          result: "updated",
          processing_time_ms: Date.now() - startTime,
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Handle V3 event format ───
    if (!evento) {
      await logWebhook(supabase, {
        event_type: "no_event",
        result: "skipped",
        reason: "No event in payload",
        processing_time_ms: Date.now() - startTime,
      });
      return new Response(JSON.stringify({ ok: true, message: "No event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = classifyEvent(evento);
    console.log(`[webhook] Event: ${evento} → classified as: ${eventType}`);

    const blingProductId = dados?.produto?.id || dados?.id || dados?.idProduto || null;
    const shouldProcess = await checkAndStoreEvent(supabase, eventId, evento, blingProductId, payload);
    if (!shouldProcess) {
      await logWebhook(supabase, {
        event_type: evento,
        event_id: eventId,
        bling_product_id: blingProductId,
        result: "duplicate",
        reason: "Duplicate event ID",
        processing_time_ms: Date.now() - startTime,
      });
      return new Response(JSON.stringify({ ok: true, message: "Duplicate event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let token: string | null = null;
    try { token = await getValidToken(supabase); } catch (_) {}
    let processingError: string | undefined;
    let webhookResult = "processed";
    let webhookReason = "";

    try {
      switch (eventType) {
        case "stock": {
          if (!config.sync_stock) {
            console.log("[webhook] sync_stock disabled, ignoring stock event");
            webhookResult = "skipped";
            webhookReason = "sync_stock disabled";
            break;
          }
          const stockBlingId = dados?.produto?.id || dados?.idProduto;
          const saldoExplicit = explicitSaldoFromWebhookPayload(dados?.saldoVirtualTotal);
          if (stockBlingId) {
            console.log(`[webhook] Stock event for bling_id=${stockBlingId}, saldoExplicit=${saldoExplicit ?? "absent"}`);
            const result = await updateStockForBlingId(supabase, stockBlingId, saldoExplicit, token || undefined);
            webhookResult = result;
            webhookReason = `Stock ${result} for bling_id=${stockBlingId}`;
          } else {
            webhookResult = "skipped";
            webhookReason = "No bling product ID in stock event";
          }
          break;
        }

        case "product": {
          const prodBlingId = dados?.id || dados?.idProduto || dados?.produto?.id;
          const eventAction = (evento || "").toLowerCase();

          if (prodBlingId) {
            // Handle product deletion — this is the ONLY case where we touch is_active
            if (eventAction.includes('deleted') || eventAction.includes('excluido') || eventAction.includes('removido')) {
              console.log(`[webhook] Product DELETED event for bling_id=${prodBlingId}`);
              const { data: delProduct } = await supabase.from("products").select("id").eq("bling_product_id", prodBlingId).maybeSingle();
              if (delProduct) {
                await supabase.from("products").update({ is_active: false }).eq("id", delProduct.id);
                await supabase.from("product_variants").update({ is_active: false }).eq("product_id", delProduct.id);
                console.log(`[webhook] Product ${prodBlingId} deactivated (deleted in Bling)`);
                webhookResult = "updated";
                webhookReason = `Product deactivated (deleted in Bling)`;
              } else {
                webhookResult = "not_found";
                webhookReason = `Product bling_id=${prodBlingId} not in DB`;
              }
            } else if (token) {
              // Creation/update — config-aware, never changes is_active
              console.log(`[webhook] Product event for bling_id=${prodBlingId}`);
              await syncSingleProduct(supabase, prodBlingId, token, config);
              webhookResult = "updated";
              webhookReason = `Product synced`;
            }
          } else {
            webhookResult = "skipped";
            webhookReason = "No product ID in payload";
          }
          break;
        }

        case "order":
        case "invoice":
          console.log(`[webhook] ${eventType} event acknowledged: ${evento}`);
          webhookResult = "skipped";
          webhookReason = `${eventType} event acknowledged (not processed)`;
          break;

        default:
          console.log(`[webhook] Unknown event type: ${evento}`);
          webhookResult = "skipped";
          webhookReason = `Unknown event type: ${evento}`;
      }
    } catch (err: any) {
      processingError = err.message;
      webhookResult = "error";
      webhookReason = err.message;
      console.error(`[webhook] Processing error for ${eventId}:`, err.message);
    }

    await markEventProcessed(supabase, eventId, processingError);
    
    // Log to bling_webhook_logs
    await logWebhook(supabase, {
      event_type: evento,
      event_id: eventId,
      bling_product_id: blingProductId,
      payload_meta: { event: evento, type: eventType, product_id: blingProductId },
      result: webhookResult,
      reason: webhookReason,
      status_code: processingError ? 500 : 200,
      processing_time_ms: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ ok: true, evento, eventType, result: webhookResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[webhook] Error:", error);
    // Try to log the fatal error
    try {
      const supabase = createSupabase();
      await logWebhook(supabase, {
        event_type: "fatal_error",
        result: "error",
        reason: error.message,
        status_code: 500,
        processing_time_ms: Date.now() - startTime,
      });
    } catch (_) {}
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
