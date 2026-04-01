import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";
import { hasRecentLocalMovements } from "../_shared/blingStockPush.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BLING_API_URL = "https://api.bling.com.br/Api/v3";

function createSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Use shared token refresh with optimistic locking
import { getValidTokenSafe } from "../_shared/blingTokenRefresh.ts";

async function getValidToken(supabase: any): Promise<string> {
  return getValidTokenSafe(supabase);
}

serve(async (req) => {
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
        .in("role", ["owner", "manager", "operator"])
        .eq("is_active", true)
        .maybeSingle();
      if (!memberData) throw new Error("Acesso negado: apenas administradores");
    }

    const { product_id } = await req.json();
    if (!product_id) throw new Error("product_id é obrigatório");

    // 1. Fetch product with variants
    const { data: product, error: prodErr } = await supabase
      .from("products")
      .select("id, name, sku, is_active, bling_product_id, bling_sync_status")
      .eq("id", product_id)
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
          .not("sku", "is", null);
        
        const firstSku = variants?.[0]?.sku;
        if (!firstSku) {
          await supabase.from("products").update({
            bling_sync_status: "error",
            bling_last_error: "Produto sem bling_product_id e sem SKU para buscar no Bling",
          }).eq("id", product_id);
          return new Response(JSON.stringify({
            success: false, error: "no_bling_id",
            message: "Produto sem vínculo com o Bling e sem SKU para busca",
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        searchSku = firstSku;
      }
    }

    const token = await getValidToken(supabase);
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
        }).eq("id", product_id);
        return new Response(JSON.stringify({
          success: false, error: "not_found_in_bling",
          message: `SKU "${searchSku}" não encontrado no Bling`,
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      blingProductId = found.id;
      // Link the bling_product_id for future syncs
      await supabase.from("products").update({ bling_product_id: blingProductId }).eq("id", product_id);
    }

    // 5. Fetch product detail from Bling to get variations
    const detailRes = await fetchWithTimeout(`${BLING_API_URL}/produtos/${blingProductId}`, { headers });
    if (!detailRes.ok) {
      const errBody = await detailRes.text();
      console.error(`[bling-sync-single-stock] Bling API returned ${detailRes.status} for product ${blingProductId}: ${errBody}`);
      // If 401, token may be expired — try refresh once
      if (detailRes.status === 401) {
        // Force token refresh and retry once
        const newToken = await getValidToken(supabase);
        const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
        const retryRes = await fetchWithTimeout(`${BLING_API_URL}/produtos/${blingProductId}`, { headers: retryHeaders });
        if (!retryRes.ok) {
          const retryBody = await retryRes.text();
          await supabase.from("products").update({
            bling_sync_status: "error",
            bling_last_error: `Bling API erro ${retryRes.status}: ${retryBody.substring(0, 500)}`,
          }).eq("id", product_id);
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
          }).eq("id", product_id);
          throw new Error("Bling API rate-limited (429) após retry");
        }
        const retryJson = await retryRes.json();
        var detail = retryJson?.data;
      } else {
        await supabase.from("products").update({
          bling_sync_status: "error",
          bling_last_error: `Bling API erro ${detailRes.status}: ${errBody.substring(0, 500)}`,
        }).eq("id", product_id);
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
      .select("id, sku, bling_variant_id, stock_quantity")
      .eq("product_id", product_id);

    let updatedVariants = 0;
    let skippedRecent = 0;

    // Collect all bling IDs to fetch stock in batch
    const blingIds: number[] = [];
    
    // Map: bling_variant_id -> local variant
    const variantByBlingId = new Map<number, any>();
    const variantBySku = new Map<string, any>();
    
    for (const v of (localVariants || [])) {
      if (v.bling_variant_id) {
        variantByBlingId.set(v.bling_variant_id, v);
        blingIds.push(v.bling_variant_id);
      }
      if (v.sku) variantBySku.set(v.sku, v);
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
    
    for (let i = 0; i < uniqueIds.length; i += 50) {
      const batch = uniqueIds.slice(i, i + 50);
      const idsParam = batch.map(id => `idsProdutos[]=${id}`).join("&");
      try {
        const stockRes = await fetchWithTimeout(`${BLING_API_URL}/estoques/saldos?${idsParam}`, { headers });
        const stockJson = await stockRes.json();
        for (const s of (stockJson?.data || [])) {
          stockMap.set(s.produto?.id, s.saldoVirtualTotal ?? 0);
        }
      } catch (_) { /* ignore stock fetch errors for individual batches */ }
    }

    // 7. Update local variants with Bling stock (with hasRecentLocalMovements protection)
    if (detail.variacoes?.length) {
      for (const bv of detail.variacoes) {
        const stock = stockMap.get(bv.id) ?? 0;
        const localVar = variantByBlingId.get(bv.id);
        
        if (localVar) {
          if (localVar.stock_quantity !== stock) {
            // Check for recent local movements before overwriting
            const hasRecent = await hasRecentLocalMovements(supabase, localVar.id, 10);
            if (hasRecent) {
              console.log(`[single-stock] Skipping variant ${localVar.id} — recent local movements`);
              skippedRecent++;
              continue;
            }
            await supabase.from("product_variants").update({ stock_quantity: stock }).eq("id", localVar.id);
            // Record inventory movement for audit
            await supabase.from("inventory_movements").insert({
              variant_id: localVar.id, quantity: stock - localVar.stock_quantity, type: "bling_sync",
            }).then(() => {}).catch(() => {});
            updatedVariants++;
          }
        } else {
          // Try SKU match
          const sku = bv.codigo || null;
          if (sku) {
            const skuVar = variantBySku.get(sku);
            if (skuVar) {
              // Check for recent local movements
              const hasRecent = await hasRecentLocalMovements(supabase, skuVar.id, 10);
              if (hasRecent) {
                console.log(`[single-stock] Skipping SKU-matched variant ${skuVar.id} — recent local movements`);
                skippedRecent++;
                // Still link the bling_variant_id even if skipping stock
                await supabase.from("product_variants").update({ bling_variant_id: bv.id }).eq("id", skuVar.id);
                continue;
              }
              const oldStock = skuVar.stock_quantity ?? 0;
              const updates: any = { stock_quantity: stock, bling_variant_id: bv.id };
              await supabase.from("product_variants").update(updates).eq("id", skuVar.id);
              // Record inventory movement
              if (stock !== oldStock) {
                await supabase.from("inventory_movements").insert({
                  variant_id: skuVar.id, quantity: stock - oldStock, type: "bling_sync",
                }).then(() => {}).catch(() => {});
              }
              updatedVariants++;
            }
          }
        }
      }
    } else {
      // Simple product (no variations) - update default variant
      const parentStock = stockMap.get(blingProductId) ?? 0;
      if (localVariants?.length) {
        for (const lv of localVariants) {
          if (lv.stock_quantity !== parentStock) {
            // Check for recent local movements
            const hasRecent = await hasRecentLocalMovements(supabase, lv.id, 10);
            if (hasRecent) {
              console.log(`[single-stock] Skipping variant ${lv.id} (no-variation product) — recent local movements`);
              skippedRecent++;
              continue;
            }
            const oldStock = lv.stock_quantity ?? 0;
            await supabase.from("product_variants").update({ stock_quantity: parentStock }).eq("id", lv.id);
            // Record inventory movement
            if (parentStock !== oldStock) {
              await supabase.from("inventory_movements").insert({
                variant_id: lv.id, quantity: parentStock - oldStock, type: "bling_sync",
              }).then(() => {}).catch(() => {});
            }
            updatedVariants++;
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
    }).eq("id", product_id);

    // 9. Log the sync action
    await supabase.from("product_change_log").insert({
      product_id,
      changed_by: user.id,
      change_type: "bling_stock_sync",
      fields_changed: ["stock_quantity"],
      notes: `Sincronização manual de estoque via Bling. ${updatedVariants} variante(s) atualizada(s)${skippedRecent > 0 ? `, ${skippedRecent} ignorada(s) por movimentos recentes` : ''}.`,
      after_data: { updated_variants: updatedVariants, skipped_recent: skippedRecent, synced_at: now },
    });

    return new Response(JSON.stringify({
      success: true,
      updated_variants: updatedVariants,
      skipped_recent: skippedRecent,
      synced_at: now,
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
