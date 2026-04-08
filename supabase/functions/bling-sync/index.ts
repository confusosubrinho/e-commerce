import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getFirstImportFields, getConfigAwareUpdateFields, getSyncConfig } from "../_shared/bling-sync-fields.ts";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";
import { fetchWithRateLimit } from "../_shared/blingFetchWithRateLimit.ts";
import { getValidTokenSafe } from "../_shared/blingTokenRefresh.ts";
import { hasRecentLocalMovements } from "../_shared/blingStockPush.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { parseRequestedTenantId, resolveAdminTenantContext } from "../_shared/blingTenant.ts";
import {
  auditBlingSaldosBatch,
  blingIdMissingExplicitInAudit,
  blingVariantSyncDecisionColumns,
  BlingStockCircuitBreaker,
  canApplyParentStockFallback,
  evaluateSkuRelinkOnProduct,
  explicitSaldoForBlingProductIdFromRows,
  logBlingVariantSyncAction,
  logBlingSaldosBatchAudit,
  mergeExplicitSaldosIntoMap,
  normalizeBlingSku,
  parseBlingStockCircuitConfig,
  resolveSafeStockUpdate,
  type BlingStockMatchType,
} from "../_shared/blingStockSafe.ts";
import type { BlingSyncConfig } from "../_shared/bling-sync-fields.ts";

const BLING_API_URL = "https://api.bling.com.br/Api/v3";
const BLING_RATE_LIMIT_MS = 340;
const BLING_ALLOW_DESTRUCTIVE_CLEANUP = ["1", "true", "yes", "on"].includes(
  (Deno.env.get("BLING_SYNC_ALLOW_DESTRUCTIVE_CLEANUP") || "").toLowerCase(),
);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// fetchWithRateLimit is now imported from _shared/blingFetchWithRateLimit.ts

const STANDARD_SIZES = ['33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44'];

const COLOR_MAP: Record<string, string> = {
  'preto': '#000000', 'branco': '#FFFFFF', 'vermelho': '#EF4444', 'azul': '#3B82F6',
  'rosa': '#EC4899', 'nude': '#D4A574', 'caramelo': '#C68642', 'marrom': '#8B4513',
  'dourado': '#FFD700', 'prata': '#C0C0C0', 'verde': '#22C55E', 'bege': '#F5F5DC',
  'amarelo': '#EAB308', 'laranja': '#F97316', 'cinza': '#6B7280', 'vinho': '#722F37',
  'bordo': '#800020', 'coral': '#FF7F50', 'lilas': '#C8A2C8', 'roxo': '#7C3AED',
  'creme': '#FFFDD0', 'camel': '#C19A6B', 'off white': '#FAF9F6', 'off-white': '#FAF9F6',
  'animal print': '#C68642', 'onca': '#C68642', 'oncinha': '#C68642', 'leopardo': '#C68642',
  'zebra': '#000000', 'snake': '#8B8682', 'croco': '#556B2F', 'jeans': '#4169E1',
  'mostarda': '#FFDB58', 'terracota': '#E2725B', 'areia': '#C2B280', 'petroleo': '#1B3A4B',
  'oliva': '#808000', 'chocolate': '#7B3F00', 'cafe': '#6F4E37', 'cappuccino': '#A78B71',
  'cobre': '#B87333', 'bronze': '#CD7F32', 'ouro': '#FFD700', 'rose': '#FF007F',
  'rosê': '#FF007F', 'rose gold': '#B76E79', 'champagne': '#F7E7CE', 'perola': '#F0EAD6',
  'pérola': '#F0EAD6', 'turquesa': '#40E0D0', 'marsala': '#986868', 'goiaba': '#E85D75',
  'salmao': '#FA8072', 'salmão': '#FA8072', 'fuchsia': '#FF00FF', 'magenta': '#FF00FF',
  'grafite': '#474A51', 'caqui': '#C3B091', 'mel': '#EB9605', 'natural': '#F5F5DC',
  'transparente': '#FFFFFF', 'multicolor': '#FF69B4', 'colorido': '#FF69B4',
};
const COLOR_KEYWORDS = Object.keys(COLOR_MAP);

interface SyncLogEntry {
  bling_id: number;
  name: string;
  status: 'imported' | 'updated' | 'skipped' | 'error' | 'grouped' | 'linked_sku' | 'ignored_inactive';
  message: string;
  variants: number;
}

function createSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// getSyncConfig is now imported from _shared/bling-sync-fields.ts

// getValidToken is now imported as getValidTokenSafe from _shared/blingTokenRefresh.ts
async function getValidToken(supabase: any, tenantId: string): Promise<string> {
  return getValidTokenSafe(supabase, { tenantId });
}

function blingHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}`, Accept: "application/json" };
}

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function generateHexFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const clamp = (v: number) => Math.min(220, Math.max(40, Math.abs(v) & 0xFF));
  return `#${clamp(hash >> 0).toString(16).padStart(2, '0')}${clamp(hash >> 8).toString(16).padStart(2, '0')}${clamp(hash >> 16).toString(16).padStart(2, '0')}`;
}

function normalizeSize(raw: string): string {
  if (!raw) return "Único";
  const trimmed = raw.trim();
  const numMatch = trimmed.match(/^(\d+)/);
  if (numMatch) {
    const num = numMatch[1];
    if (STANDARD_SIZES.includes(num)) return num;
    const str = String(parseInt(num, 10));
    if (STANDARD_SIZES.includes(str)) return str;
  }
  const lower = trimmed.toLowerCase();
  if (lower === "único" || lower === "unico" || lower === "u" || lower === "un") return "Único";
  if (["p", "pp", "m", "g", "gg", "xg"].includes(lower)) return trimmed.toUpperCase();
  return trimmed;
}

function extractColorFromName(name: string): string | null {
  if (!name) return null;
  const lower = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sorted = [...COLOR_KEYWORDS].sort((a, b) => b.length - a.length);
  for (const keyword of sorted) {
    const nk = keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lower.includes(nk)) return keyword.charAt(0).toUpperCase() + keyword.slice(1);
  }
  return null;
}

function extractSizeFromName(name: string): string | null {
  if (!name) return null;
  const m1 = name.match(/tamanho\s*[:=]\s*(\d+)/i); if (m1) return m1[1];
  const m2 = name.match(/tam\.?\s*(\d+)/i); if (m2) return m2[1];
  const m3 = name.match(/n[uú]mero?\s*[:=]\s*(\d+)/i); if (m3) return m3[1];
  const sn = name.match(/\b(3[3-9]|4[0-4])\b/g);
  if (sn && sn.length === 1) return sn[0];
  const cm = name.match(/\b(PP|GG|XG|EXG|EXGG)\b/i) || name.match(/\b([PMGU])\b/i);
  if (cm) return cm[1].toUpperCase();
  return null;
}

function parseVariationAttributes(nome: string): { size: string; color: string | null; colorHex: string | null } {
  if (!nome) return { size: "Único", color: null, colorHex: null };
  const parts: Record<string, string> = {};
  nome.replace(/\|/g, ";").split(";").forEach(part => {
    const idx = part.indexOf(":");
    if (idx > 0) { const k = part.substring(0, idx).trim().toLowerCase(); const v = part.substring(idx + 1).trim(); if (k && v) parts[k] = v; }
  });
  let rawSize = parts["tamanho"] || parts["tam"] || parts["size"] || parts["numero"] || parts["num"] || null;
  let color = parts["cor"] || parts["color"] || parts["colour"] || null;
  if (!rawSize) rawSize = extractSizeFromName(nome);
  if (!color) color = extractColorFromName(nome);
  let colorHex: string | null = null;
  if (color) {
    const nc = color.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    colorHex = COLOR_MAP[nc] || COLOR_MAP[color.toLowerCase()] || generateHexFromString(nc);
  }
  return { size: normalizeSize(rawSize || "Único"), color, colorHex };
}

function extractAttributesFromBlingVariation(varDetail: any, listingName: string, listingAttributes: string): { size: string; color: string | null; colorHex: string | null; sku: string | null } {
  let parsed = { size: "Único", color: null as string | null, colorHex: null as string | null };
  if (varDetail?.atributos?.length) {
    for (const attr of varDetail.atributos) {
      const an = (attr.nome || attr.name || "").toLowerCase().trim();
      const av = (attr.valor || attr.value || "").trim();
      if (!av) continue;
      if (["tamanho", "tam", "size", "numero"].includes(an)) parsed.size = normalizeSize(av);
      else if (["cor", "color", "colour"].includes(an)) {
        parsed.color = av.charAt(0).toUpperCase() + av.slice(1);
        const nc = av.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        parsed.colorHex = COLOR_MAP[nc] || COLOR_MAP[av.toLowerCase()] || generateHexFromString(nc);
      }
    }
    if (parsed.size !== "Único" || parsed.color) return { ...parsed, sku: varDetail?.codigo || null };
  }
  if (varDetail?.variacao?.nome) parsed = parseVariationAttributes(varDetail.variacao.nome);
  if (parsed.size === "Único" && !parsed.color && varDetail?.nome) parsed = parseVariationAttributes(varDetail.nome);
  if (parsed.size === "Único" && !parsed.color && listingAttributes) {
    const fa = parseVariationAttributes(listingAttributes);
    if (fa.size !== "Único") parsed.size = fa.size;
    if (fa.color) { parsed.color = fa.color; parsed.colorHex = fa.colorHex; }
  }
  const fullName = varDetail?.nome || listingName || "";
  if (parsed.size === "Único") { const s = extractSizeFromName(fullName); if (s) parsed.size = normalizeSize(s); }
  if (!parsed.color) {
    const c = extractColorFromName(fullName);
    if (c) { parsed.color = c; const nc = c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); parsed.colorHex = COLOR_MAP[nc] || COLOR_MAP[c.toLowerCase()] || generateHexFromString(nc); }
  }
  return { ...parsed, sku: varDetail?.codigo || null };
}

function extractParentInfoFromName(name: string): { parentBlingId: number | null; baseName: string; attributes: string; hasAttributes: boolean } {
  const match = name.match(/^(.+?)\s*\((\d+)\)\s*(.*)$/);
  if (match) return { baseName: match[1].trim(), parentBlingId: parseInt(match[2], 10), attributes: match[3].trim(), hasAttributes: !!match[3].trim() };
  const attrMatch = name.match(/^(.+?)\s+((?:Cor|Tamanho|cor|tamanho)\s*:.+)$/i);
  if (attrMatch) return { baseName: attrMatch[1].trim(), parentBlingId: null, attributes: attrMatch[2].trim(), hasAttributes: true };
  return { parentBlingId: null, baseName: name, attributes: "", hasAttributes: false };
}

async function findOrCreateCategory(supabase: any, categoryName: string, tenantId: string): Promise<string | null> {
  if (!categoryName) return null;
  let { data: cat } = await supabase
    .from("categories")
    .select("id")
    .eq("name", categoryName)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (cat) return cat.id;
  const normalized = categoryName.toLowerCase().trim();
  const { data: allCats } = await supabase
    .from("categories")
    .select("id, name")
    .eq("tenant_id", tenantId);
  if (allCats?.length) {
    const match = allCats.find((c: any) => { const n = c.name.toLowerCase().trim(); return n === normalized || n.includes(normalized) || normalized.includes(n); });
    if (match) return match.id;
    const inputWords = normalized.split(/\s+/).filter(w => w.length > 2);
    let bestMatch: any = null, bestScore = 0;
    for (const c of allCats) {
      const catWords = c.name.toLowerCase().trim().split(/\s+/).filter((w: string) => w.length > 2);
      const overlap = inputWords.filter(w => catWords.some((cw: string) => cw.includes(w) || w.includes(cw))).length;
      const score = overlap / Math.max(inputWords.length, catWords.length);
      if (score > bestScore && score >= 0.5) { bestScore = score; bestMatch = c; }
    }
    if (bestMatch) return bestMatch.id;
  }
  const catSlug = slugify(categoryName);
  const { data: existingSlug } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", catSlug)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const finalSlug = existingSlug ? `${catSlug}-${Date.now()}` : catSlug;
  const { data: newCat } = await supabase
    .from("categories")
    .insert({ name: categoryName, slug: finalSlug, is_active: true, tenant_id: tenantId })
    .select("id")
    .single();
  return newCat?.id || null;
}

// ─── Download image from external URL and re-upload to Supabase Storage ───
async function downloadAndReuploadImage(supabase: any, imageUrl: string, productId: string, index: number): Promise<string> {
  try {
    // If already a Supabase public URL, return as-is
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    if (imageUrl.includes(supabaseUrl) && !imageUrl.includes("Expires=")) {
      return imageUrl;
    }

    // Download image
    const response = await fetchWithTimeout(imageUrl);
    if (!response.ok) {
      console.warn(`[sync] Failed to download image: ${response.status} - ${imageUrl.substring(0, 100)}`);
      // Return URL without signature as fallback (will be broken but at least clean)
      return imageUrl.split("?")[0];
    }

    const blob = await response.blob();
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const fileName = `bling/${productId}/${index}-${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("product-media")
      .upload(fileName, blob, { contentType, upsert: true });

    if (uploadError) {
      console.warn(`[sync] Failed to upload image to storage: ${uploadError.message}`);
      return imageUrl.split("?")[0];
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("product-media")
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (err: any) {
    console.warn(`[sync] Image re-upload error: ${err.message}`);
    return imageUrl.split("?")[0];
  }
}

// ─── Upsert a parent product and all its variants (config-aware) ───
async function upsertParentWithVariants(
  supabase: any, headers: any, parentDetail: any, parentBlingId: number,
  variationItems: Array<{ blingId: number; name: string; attributes: string }>,
  getCategoryId: (name: string) => Promise<string | null>,
  resolveBlingCategory: (blingCatId: number | null) => Promise<string>,
  config: BlingSyncConfig,
  tenantId: string,
): Promise<{ imported: boolean; updated: boolean; linkedBySku: boolean; variantCount: number; error?: string }> {
  const slug = slugify(parentDetail.nome || `produto-${parentBlingId}`);
  const basePrice = parentDetail.preco || 0;
  const blingCatId = parentDetail.categoria?.id || null;
  const categoryName = await resolveBlingCategory(blingCatId);
  const categoryId = await getCategoryId(categoryName);

  // Check if product exists by bling_product_id
  let existing = await supabase
    .from("products")
    .select("id, is_active")
    .eq("bling_product_id", parentBlingId)
    .eq("tenant_id", tenantId)
    .maybeSingle()
    .then((r: any) => r.data);

  // SKU merge: try finding by SKU if not found by bling_id
  let linkedBySku = false;
  if (!existing && config.merge_by_sku && parentDetail.codigo) {
    // Try matching product by SKU via variants
    const { data: skuVar } = await supabase
      .from("product_variants")
      .select("id, product_id")
      .eq("sku", parentDetail.codigo)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (skuVar) {
      // Link the product to this bling_product_id
      await supabase
        .from("products")
        .update({ bling_product_id: parentBlingId })
        .eq("id", skuVar.product_id)
        .eq("tenant_id", tenantId);
      existing = await supabase
        .from("products")
        .select("id, is_active")
        .eq("id", skuVar.product_id)
        .eq("tenant_id", tenantId)
        .maybeSingle()
        .then((r: any) => r.data);
      linkedBySku = true;
      console.log(`[sync] Linked product ${skuVar.product_id} to bling_id=${parentBlingId} via SKU=${parentDetail.codigo}`);
    }
  }

  let productId: string;
  let imported = false;
  let updated = false;

  if (existing) {
    // CRITICAL: Skip inactive products entirely
    if (existing.is_active === false) {
      return { imported: false, updated: false, linkedBySku, variantCount: 0, error: "Produto inativo — ignorado" };
    }

    // Update only config-enabled fields (NEVER touch is_active, slug, category_id)
    const updateData = getConfigAwareUpdateFields(parentDetail, config);
    updateData.bling_product_id = parentBlingId;
    
    if (Object.keys(updateData).length > 1) { // more than just bling_product_id
      await supabase.from("products").update(updateData).eq("id", existing.id).eq("tenant_id", tenantId);
    }
    productId = existing.id;
    updated = true;
  } else {
    if (!config.import_new_products) {
      return { imported: false, updated: false, linkedBySku: false, variantCount: 0, error: "Importação de novos desabilitada" };
    }
    // Full import for new products
    const insertData: any = {
      ...getFirstImportFields(parentDetail),
      bling_product_id: parentBlingId,
      mpn: parentDetail.codigo || null,
      material: null,
      is_new: parentDetail.lancamento === true || parentDetail.lancamento === "S",
      category_id: categoryId,
    };
    const { data: slugExists } = await supabase
      .from("products")
      .select("id")
      .eq("slug", slug)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    insertData.slug = slugExists ? `${slug}-${parentBlingId}` : slug;
    insertData.tenant_id = tenantId;
    const { data: newProd, error: insertErr } = await supabase.from("products").insert(insertData).select("id").single();
    if (insertErr) return { imported: false, updated: false, linkedBySku: false, variantCount: 0, error: `Insert error: ${insertErr.message}` };
    productId = newProd.id;
    imported = true;
  }

  // Sync images: only on first import OR if sync_images is enabled
  // IMPORTANT: Download from Bling and re-upload to Supabase Storage to avoid signed URL expiration
  if ((imported && parentDetail.midia?.imagens?.internas?.length) ||
      (updated && config.sync_images && parentDetail.midia?.imagens?.internas?.length)) {
    await supabase.from("product_images").delete().eq("product_id", productId).eq("tenant_id", tenantId);
    const images: any[] = [];
    for (let idx = 0; idx < parentDetail.midia.imagens.internas.length; idx++) {
      const img = parentDetail.midia.imagens.internas[idx];
      const publicUrl = await downloadAndReuploadImage(supabase, img.link, productId, idx);
      images.push({
        product_id: productId,
        tenant_id: tenantId,
        url: publicUrl,
        is_primary: idx === 0,
        display_order: idx,
        alt_text: parentDetail.nome,
      });
    }
    if (images.length > 0) {
      await supabase.from("product_images").insert(images);
    }
  }

  // Sync characteristics only on first import
  if (imported) {
    const characteristics: { name: string; value: string }[] = [];
    if (parentDetail.pesoBruto) characteristics.push({ name: "Peso Bruto", value: `${parentDetail.pesoBruto} kg` });
    if (parentDetail.pesoLiquido) characteristics.push({ name: "Peso Líquido", value: `${parentDetail.pesoLiquido} kg` });
    if (parentDetail.larguraProduto) characteristics.push({ name: "Largura", value: `${parentDetail.larguraProduto} cm` });
    if (parentDetail.alturaProduto) characteristics.push({ name: "Altura", value: `${parentDetail.alturaProduto} cm` });
    if (parentDetail.profundidadeProduto) characteristics.push({ name: "Profundidade", value: `${parentDetail.profundidadeProduto} cm` });
    const brandName = parentDetail.marca?.nome || (typeof parentDetail.marca === "string" ? parentDetail.marca : null);
    if (brandName) characteristics.push({ name: "Marca", value: brandName });
    if (parentDetail.gtin) characteristics.push({ name: "GTIN/EAN", value: parentDetail.gtin });
    if (parentDetail.unidade) characteristics.push({ name: "Unidade", value: parentDetail.unidade });
    if (characteristics.length > 0) {
      await supabase.from("product_characteristics").delete().eq("product_id", productId).eq("tenant_id", tenantId);
      await supabase.from("product_characteristics").insert(
        characteristics.map((c, idx) => ({
          product_id: productId,
          tenant_id: tenantId,
          name: c.name,
          value: c.value,
          display_order: idx,
        })),
      );
    }
  }

  // ─── Sync Variants ───
  let variantCount = 0;
  const syncedVariantIds = new Set<string>();

  if (parentDetail.variacoes?.length) {
    const varIds = parentDetail.variacoes.map((v: any) => v.id);
    const varStockMap = new Map<number, number>();
    let stockFetchAllBatchesOkVar = true;
    if (config.sync_stock || imported) {
      for (let i = 0; i < varIds.length; i += 50) {
        const batch = varIds.slice(i, i + 50);
        const idsParam = batch.map((id: number) => `idsProdutos[]=${id}`).join("&");
        try {
          await sleep(BLING_RATE_LIMIT_MS);
          const stockRes = await fetchWithRateLimit(`${BLING_API_URL}/estoques/saldos?${idsParam}`, { headers });
          if (!stockRes.ok) {
            const t = await stockRes.text();
            stockFetchAllBatchesOkVar = false;
            console.warn(
              `[sync] estoques/saldos HTTP ${stockRes.status} (variações, batch ids …${batch.slice(-2).join(",")}): ${t.substring(0, 300)}`
            );
            continue;
          }
          const stockJson = await stockRes.json();
          const rowsV = stockJson?.data || [];
          const auditV = auditBlingSaldosBatch(batch, rowsV);
          logBlingSaldosBatchAudit(auditV, "bling-sync.upsert.variacoes", {
            product_id: productId,
            bling_parent_id: parentBlingId,
          });
          mergeExplicitSaldosIntoMap(varStockMap, rowsV, "bling-sync.upsert.variacoes", true);
        } catch (e) {
          stockFetchAllBatchesOkVar = false;
          console.warn(`[sync] estoques/saldos batch error (variações):`, e);
        }
      }
    }
    const missingExplicitVarIds = (config.sync_stock || imported)
      ? varIds.filter((id: number) => !varStockMap.has(id))
      : [];

    for (const v of parentDetail.variacoes) {
      const varStock = varStockMap.get(v.id);
      const varPrice = (v.preco && v.preco > 0) ? v.preco : basePrice;
      const extracted = extractAttributesFromBlingVariation(v, v.nome || "", "");
      const priceModifier = varPrice - basePrice;

      // Check existing variant by bling_variant_id
      let existingVar = await supabase
        .from("product_variants")
        .select("id, is_active")
        .eq("bling_variant_id", v.id)
        .eq("tenant_id", tenantId)
        .maybeSingle()
        .then((r: any) => r.data);

      // SKU merge for variants (SKU normalizado único no produto)
      if (!existingVar && config.merge_by_sku && (extracted.sku || v.codigo)) {
        const skuRaw = extracted.sku || v.codigo;
        const { data: prodVars } = await supabase
          .from("product_variants")
          .select("id, sku, is_active")
          .eq("product_id", productId)
          .eq("tenant_id", tenantId);
        const relinkPool = config.sync_variant_active
          ? (prodVars || [])
          : (prodVars || []).filter((pv: any) => pv.is_active !== false);
        const relink = evaluateSkuRelinkOnProduct(relinkPool, skuRaw);
        if (relink.ok) {
          await supabase
            .from("product_variants")
            .update({ bling_variant_id: v.id })
            .eq("id", relink.variantId)
            .eq("tenant_id", tenantId);
          existingVar = { id: relink.variantId, is_active: relinkPool.find((pv: any) => pv.id === relink.variantId)?.is_active };
          console.log(`[sync] Linked variant ${relink.variantId} to bling_variant_id=${v.id} via SKU=${skuRaw}`);
        } else {
          console.warn(JSON.stringify({
            level: "warn",
            message: "SKU relink skipped (unicidade/normalização)",
            context: "bling-sync.upsert.merge_by_sku",
            product_id: productId,
            bling_variant_id: v.id,
            reason: relink.reason,
          }));
        }
      }

      if (existingVar) {
        // Update existing variant: stock sempre via resolveSafeStockUpdate se habilitado
        const varUpdate: any = {};
        if ((config.sync_stock || imported) && (existingVar.is_active !== false || config.sync_variant_active)) {
          const { data: curVar } = await supabase
            .from("product_variants")
            .select("stock_quantity")
            .eq("id", existingVar.id)
            .eq("tenant_id", tenantId)
            .maybeSingle();
          const oldSq = curVar?.stock_quantity ?? 0;
          const hasRecent = await hasRecentLocalMovements(supabase, existingVar.id, 10, tenantId);
          const resolved = resolveSafeStockUpdate({
            batchHttpOk: stockFetchAllBatchesOkVar,
            explicitSaldo: varStock,
            inPartialBatchMissingSaldo: missingExplicitVarIds.includes(v.id),
            hasRecentLocalMovement: hasRecent,
            matchType: "bling_variant_id",
            oldStock: oldSq,
          });
          Object.assign(varUpdate, blingVariantSyncDecisionColumns(resolved, "bling-sync.upsert.variacoes"));
          if (resolved.shouldApplyStock && resolved.new_stock !== undefined) {
            varUpdate.stock_quantity = resolved.new_stock;
          }
        } else if ((config.sync_stock || imported) && existingVar.is_active === false) {
          logBlingVariantSyncAction({
            action: "skipped",
            context: "bling-sync.upsert.variacoes",
            product_id: productId,
            variant_id: existingVar.id,
            local_sku: extracted.sku || v.codigo || null,
            bling_variant_id: v.id,
            reason: "inactive_variant_stock_not_synced_without_sync_variant_active",
          });
        }
        if (config.sync_variant_active) varUpdate.is_active = v.situacao !== "I";
        // NEVER update is_active unless toggle is on
        if (Object.keys(varUpdate).length > 0) {
          await supabase.from("product_variants").update(varUpdate).eq("id", existingVar.id).eq("tenant_id", tenantId);
        }
        syncedVariantIds.add(existingVar.id);
      } else {
        // New variant — full data (estoque só se o Bling devolveu saldo explícito para este id)
        const varData: any = {
          product_id: productId, size: extracted.size, color: extracted.color, color_hex: extracted.colorHex,
          sku: extracted.sku || v.codigo || null,
          is_active: v.situacao !== "I", bling_variant_id: v.id,
          price_modifier: priceModifier !== 0 ? priceModifier : 0,
          tenant_id: tenantId,
        };
        if (varStock !== undefined) varData.stock_quantity = varStock;
        const { data: newVar } = await supabase.from("product_variants").insert(varData).select("id").single();
        if (newVar) syncedVariantIds.add(newVar.id);
      }
      variantCount++;
    }
  }

  // Variation items from listing
  if (variationItems.length > 0) {
    const varStockMap = new Map<number, number>();
    const viBlingIds = variationItems.map((x: { blingId: number }) => x.blingId);
    let stockFetchAllBatchesOkVi = true;
    if (config.sync_stock || imported) {
      for (let i = 0; i < variationItems.length; i += 50) {
        const batch = variationItems.slice(i, i + 50);
        const idsParam = batch.map(v => `idsProdutos[]=${v.blingId}`).join("&");
        try {
          await sleep(BLING_RATE_LIMIT_MS);
          const stockRes = await fetchWithRateLimit(`${BLING_API_URL}/estoques/saldos?${idsParam}`, { headers });
          if (!stockRes.ok) {
            const t = await stockRes.text();
            stockFetchAllBatchesOkVi = false;
            console.warn(
              `[sync] estoques/saldos HTTP ${stockRes.status} (variationItems): ${t.substring(0, 300)}`
            );
            continue;
          }
          const stockJson = await stockRes.json();
          const rowsVi = stockJson?.data || [];
          const auditVi = auditBlingSaldosBatch(
            batch.map((v: { blingId: number }) => v.blingId),
            rowsVi,
          );
          logBlingSaldosBatchAudit(auditVi, "bling-sync.upsert.variationItems", {
            product_id: productId,
          });
          mergeExplicitSaldosIntoMap(varStockMap, rowsVi, "bling-sync.upsert.variationItems", true);
        } catch (e) {
          stockFetchAllBatchesOkVi = false;
          console.warn(`[sync] estoques/saldos batch error (variationItems):`, e);
        }
      }
    }
    const missingExplicitViIds = (config.sync_stock || imported)
      ? viBlingIds.filter((bid: number) => !varStockMap.has(bid))
      : [];

    for (const vi of variationItems) {
      const { data: alreadySynced } = await supabase
        .from("product_variants")
        .select("id, is_active")
        .eq("bling_variant_id", vi.blingId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (alreadySynced && syncedVariantIds.has(alreadySynced.id)) continue;
      const extracted = parseVariationAttributes(vi.attributes || vi.name);
      const varStock = varStockMap.get(vi.blingId);
      const varData: any = {
        product_id: productId, size: extracted.size, color: extracted.color, color_hex: extracted.colorHex,
        sku: null, is_active: true, bling_variant_id: vi.blingId, price_modifier: 0,
        tenant_id: tenantId,
      };
      if (varStock !== undefined) varData.stock_quantity = varStock;
      if (alreadySynced) {
        const varUpdate: any = {};
        if ((config.sync_stock || imported) && (alreadySynced.is_active !== false || config.sync_variant_active)) {
          const { data: curVi } = await supabase
            .from("product_variants")
            .select("stock_quantity")
            .eq("id", alreadySynced.id)
            .eq("tenant_id", tenantId)
            .maybeSingle();
          const oldSqVi = curVi?.stock_quantity ?? 0;
          const hasRecentVi = await hasRecentLocalMovements(supabase, alreadySynced.id, 10, tenantId);
          const resolvedVi = resolveSafeStockUpdate({
            batchHttpOk: stockFetchAllBatchesOkVi,
            explicitSaldo: varStock,
            inPartialBatchMissingSaldo: missingExplicitViIds.includes(vi.blingId),
            hasRecentLocalMovement: hasRecentVi,
            matchType: "bling_variant_id",
            oldStock: oldSqVi,
          });
          Object.assign(varUpdate, blingVariantSyncDecisionColumns(resolvedVi, "bling-sync.upsert.variationItems"));
          if (resolvedVi.shouldApplyStock && resolvedVi.new_stock !== undefined) {
            varUpdate.stock_quantity = resolvedVi.new_stock;
          }
        } else if ((config.sync_stock || imported) && alreadySynced.is_active === false) {
          logBlingVariantSyncAction({
            action: "skipped",
            context: "bling-sync.upsert.variationItems",
            product_id: productId,
            variant_id: alreadySynced.id,
            bling_variant_id: vi.blingId,
            reason: "inactive_variant_stock_not_synced_without_sync_variant_active",
          });
        }
        if (Object.keys(varUpdate).length > 0) {
          await supabase.from("product_variants").update(varUpdate).eq("id", alreadySynced.id).eq("tenant_id", tenantId);
        }
        syncedVariantIds.add(alreadySynced.id);
      } else {
        const { data: newVar } = await supabase.from("product_variants").insert(varData).select("id").single();
        if (newVar) syncedVariantIds.add(newVar.id);
      }
      variantCount++;
    }
  }

  // Default "Único" variant if none.
  // Safety: if local already has variants, preserve them (não criar/reativar automaticamente).
  if (variantCount === 0) {
    const { data: existingProductVariants } = await supabase
      .from("product_variants")
      .select("id, stock_quantity, is_active, sku, size")
      .eq("product_id", productId)
      .eq("tenant_id", tenantId);

    const activeExistingVariants = (existingProductVariants || []).filter((v: any) => v.is_active !== false);

    const fetchParentSimpleStock = async () => {
      let simpleExplicitSaldo: number | undefined = undefined;
      let simpleBatchHttpOk = true;
      let simpleInPartialBatch = false;

      if (config.sync_stock || imported) {
        try {
          const stockRes = await fetchWithRateLimit(
            `${BLING_API_URL}/estoques/saldos?idsProdutos[]=${parentBlingId}`,
            { headers },
          );
          if (!stockRes.ok) {
            simpleBatchHttpOk = false;
            const t = await stockRes.text();
            console.warn(
              JSON.stringify({
                level: "warn",
                message: "Bling estoques/saldos HTTP error (produto simples)",
                context: "bling-sync.upsert.simpleProduct",
                bling_product_id: parentBlingId,
                status: stockRes.status,
                body: t.substring(0, 300),
              }),
            );
          } else {
            const stockJson = await stockRes.json();
            const rows: any[] = stockJson?.data || [];
            const simpleAudit = auditBlingSaldosBatch([parentBlingId], rows);
            logBlingSaldosBatchAudit(simpleAudit, "bling-sync.upsert.simpleProduct", {
              product_id: productId,
              bling_product_id: parentBlingId,
            });
            simpleExplicitSaldo = explicitSaldoForBlingProductIdFromRows(rows, parentBlingId);
            simpleInPartialBatch = blingIdMissingExplicitInAudit(simpleAudit, parentBlingId) && simpleExplicitSaldo === undefined;
          }
        } catch (e) {
          simpleBatchHttpOk = false;
          console.warn(`[sync] estoques/saldos error (produto simples ${parentBlingId}):`, e);
        }
      }

      return { simpleExplicitSaldo, simpleBatchHttpOk, simpleInPartialBatch };
    };

    if ((existingProductVariants || []).length > 0) {
      if (activeExistingVariants.length > 1) {
        for (const localVariant of activeExistingVariants) {
          syncedVariantIds.add(localVariant.id);
          logBlingVariantSyncAction({
            action: "mismatch",
            context: "bling-sync.upsert.simpleProduct",
            product_id: productId,
            variant_id: localVariant.id,
            local_sku: localVariant.sku ?? null,
            bling_variant_id: parentBlingId,
            previous_stock: localVariant.stock_quantity ?? 0,
            reason: "no_bling_variations_payload_for_multi_variant_product",
          });
        }
        variantCount = activeExistingVariants.length;
      } else if (
        activeExistingVariants.length === 1 &&
        canApplyParentStockFallback(activeExistingVariants.length, (existingProductVariants || []).length)
      ) {
        const targetVariant = activeExistingVariants[0];
        syncedVariantIds.add(targetVariant.id);

        if (config.sync_stock || imported) {
          const { simpleExplicitSaldo, simpleBatchHttpOk, simpleInPartialBatch } = await fetchParentSimpleStock();
          const hasRecent = await hasRecentLocalMovements(supabase, targetVariant.id, 10, tenantId);
          const oldSq = targetVariant.stock_quantity ?? 0;
          const resolved = resolveSafeStockUpdate({
            batchHttpOk: simpleBatchHttpOk,
            explicitSaldo: simpleExplicitSaldo,
            inPartialBatchMissingSaldo: simpleInPartialBatch,
            hasRecentLocalMovement: hasRecent,
            matchType: "bling_product_id_parent",
            oldStock: oldSq,
          });
          const meta = blingVariantSyncDecisionColumns(resolved, "bling-sync.upsert.simpleProduct");
          if (resolved.shouldApplyStock && resolved.new_stock !== undefined) {
            await supabase
              .from("product_variants")
              .update({ stock_quantity: resolved.new_stock, ...meta })
              .eq("id", targetVariant.id)
              .eq("tenant_id", tenantId);
          } else {
            await supabase
              .from("product_variants")
              .update(meta)
              .eq("id", targetVariant.id)
              .eq("tenant_id", tenantId);
          }
        }
        variantCount = 1;
      } else if (activeExistingVariants.length === 1) {
        const localVariant = activeExistingVariants[0];
        syncedVariantIds.add(localVariant.id);
        logBlingVariantSyncAction({
          action: "mismatch",
          context: "bling-sync.upsert.simpleProduct",
          product_id: productId,
          variant_id: localVariant.id,
          local_sku: localVariant.sku ?? null,
          bling_variant_id: parentBlingId,
          previous_stock: localVariant.stock_quantity ?? 0,
          reason: "parent_stock_not_applied_to_non_simple_product",
        });
        variantCount = 1;
      } else {
        for (const inactiveVariant of existingProductVariants || []) {
          syncedVariantIds.add(inactiveVariant.id);
          logBlingVariantSyncAction({
            action: "skipped",
            context: "bling-sync.upsert.simpleProduct",
            product_id: productId,
            variant_id: inactiveVariant.id,
            local_sku: inactiveVariant.sku ?? null,
            bling_variant_id: parentBlingId,
            previous_stock: inactiveVariant.stock_quantity ?? 0,
            reason: "all_local_variants_inactive",
          });
        }
        variantCount = (existingProductVariants || []).length;
      }
    } else {
      const { simpleExplicitSaldo, simpleBatchHttpOk, simpleInPartialBatch } = await fetchParentSimpleStock();
      const { data: existingDefault } = await supabase
        .from("product_variants")
        .select("id, stock_quantity, is_active")
        .eq("product_id", productId)
        .eq("size", "Único")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existingDefault) {
        syncedVariantIds.add(existingDefault.id);
        if ((config.sync_stock || imported) && (existingDefault.is_active !== false || config.sync_variant_active)) {
          const hasRecent = await hasRecentLocalMovements(supabase, existingDefault.id, 10, tenantId);
          const oldSq = existingDefault.stock_quantity ?? 0;
          const resolved = resolveSafeStockUpdate({
            batchHttpOk: simpleBatchHttpOk,
            explicitSaldo: simpleExplicitSaldo,
            inPartialBatchMissingSaldo: simpleInPartialBatch,
            hasRecentLocalMovement: hasRecent,
            matchType: "bling_product_id_parent",
            oldStock: oldSq,
          });
          const meta = blingVariantSyncDecisionColumns(resolved, "bling-sync.upsert.simpleProduct");
          if (resolved.shouldApplyStock && resolved.new_stock !== undefined) {
            await supabase
              .from("product_variants")
              .update({ stock_quantity: resolved.new_stock, ...meta })
              .eq("id", existingDefault.id)
              .eq("tenant_id", tenantId);
          } else {
            await supabase
              .from("product_variants")
              .update(meta)
              .eq("id", existingDefault.id)
              .eq("tenant_id", tenantId);
          }
        } else if ((config.sync_stock || imported) && existingDefault.is_active === false) {
          logBlingVariantSyncAction({
            action: "skipped",
            context: "bling-sync.upsert.simpleProduct",
            product_id: productId,
            variant_id: existingDefault.id,
            bling_variant_id: parentBlingId,
            previous_stock: existingDefault.stock_quantity ?? 0,
            reason: "inactive_variant_stock_not_synced_without_sync_variant_active",
          });
        }
      } else {
        const insertRow: Record<string, unknown> = { product_id: productId, size: "Único", is_active: true, tenant_id: tenantId };
        if (simpleExplicitSaldo !== undefined && simpleBatchHttpOk && !simpleInPartialBatch) {
          insertRow.stock_quantity = simpleExplicitSaldo;
        }
        const { data: createdDefault } = await supabase.from("product_variants").insert(insertRow).select("id").maybeSingle();
        if (createdDefault?.id) syncedVariantIds.add(createdDefault.id);
      }
      variantCount = 1;
    }
  }

  // Cleanup destrutivo desativado por padrão (modo conservador).
  // Ativar apenas com BLING_SYNC_ALLOW_DESTRUCTIVE_CLEANUP=true.
  if (BLING_ALLOW_DESTRUCTIVE_CLEANUP) {
    const { data: allVars } = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", productId)
      .eq("tenant_id", tenantId)
      .not("bling_variant_id", "is", null);
    for (const v of (allVars || [])) {
      if (!syncedVariantIds.has(v.id)) {
        // Check if variant is referenced in order_items before deleting
        const { data: orderRef } = await supabase
          .from("order_items")
          .select("id")
          .eq("product_variant_id", v.id)
          .eq("tenant_id", tenantId)
          .limit(1);
        if (orderRef?.length) {
          // Deactivate instead of deleting to preserve order history
          await supabase.from("product_variants").update({ is_active: false }).eq("id", v.id).eq("tenant_id", tenantId);
          console.log(`[sync] Deactivated orphaned variant ${v.id} (referenced in orders)`);
        } else {
          await supabase.from("product_variants").delete().eq("id", v.id).eq("tenant_id", tenantId);
        }
      }
    }
  } else {
    const { count: orphanedCount } = await supabase
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("tenant_id", tenantId)
      .not("bling_variant_id", "is", null);
    console.log(
      JSON.stringify({
        level: "info",
        message: "Destructive orphan cleanup skipped (conservative mode)",
        context: "bling-sync.upsert",
        product_id: productId,
        known_synced_variants: syncedVariantIds.size,
        total_bling_linked_variants: orphanedCount ?? 0,
      }),
    );
  }

  return { imported, updated, linkedBySku, variantCount };
}

// ─── Main Sync Products ───
async function syncProducts(
  supabase: any,
  token: string,
  config: BlingSyncConfig,
  tenantId: string,
  batchLimit: number = 0,
  batchOffset: number = 0,
  isFirstImport: boolean = false,
  newOnly: boolean = false,
) {
  const headers = blingHeaders(token);
  const syncLog: SyncLogEntry[] = [];
  let totalImported = 0, totalUpdated = 0, totalVariants = 0, totalSkipped = 0, totalErrors = 0, totalLinkedBySku = 0;

  const { data: storeSettings } = await supabase
    .from("store_settings")
    .select("bling_store_id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  const blingStoreId = (storeSettings as any)?.bling_store_id || null;

  const categoryCache = new Map<string, string | null>();
  async function getCategoryId(name: string): Promise<string | null> {
    if (categoryCache.has(name)) return categoryCache.get(name)!;
    const id = await findOrCreateCategory(supabase, name, tenantId);
    categoryCache.set(name, id);
    return id;
  }

  const blingCategoryCache = new Map<number, string>();
  async function resolveBlingCategory(blingCatId: number | null): Promise<string> {
    if (!blingCatId) return "";
    if (blingCategoryCache.has(blingCatId)) return blingCategoryCache.get(blingCatId)!;
    try {
      await sleep(BLING_RATE_LIMIT_MS);
      const res = await fetchWithRateLimit(`${BLING_API_URL}/categorias/produtos/${blingCatId}`, { headers });
      const json = await res.json();
      const name = json?.data?.descricao || json?.data?.nome || "";
      blingCategoryCache.set(blingCatId, name);
      return name;
    } catch (e) { blingCategoryCache.set(blingCatId, ""); return ""; }
  }

  // PHASE 1: Collect all items from Bling listing
  interface ListingItem { id: number; nome: string; formato?: string; }
  const allListingItems: ListingItem[] = [];
  let page = 1, hasMore = true;

  while (hasMore) {
    let url = `${BLING_API_URL}/produtos?pagina=${page}&limite=100`;
    if (blingStoreId) url += `&idLoja=${blingStoreId}`;
    await sleep(BLING_RATE_LIMIT_MS);
    const res = await fetchWithRateLimit(url, { headers });
    const json = await res.json();
    if (!res.ok) throw new Error(`Bling API error [${res.status}]: ${JSON.stringify(json)}`);
    const products = json?.data || [];
    if (products.length === 0) { hasMore = false; break; }
    for (const bp of products) allListingItems.push({ id: bp.id, nome: bp.descricao || bp.nome || `ID ${bp.id}`, formato: bp.formato });
    page++;
    if (products.length < 100) hasMore = false;
  }

  // PHASE 2: Classify items
  interface ProductGroup { parentBlingId: number; parentListItem: ListingItem | null; variationItems: Array<{ blingId: number; name: string; attributes: string }>; isSimple: boolean; }
  const groups = new Map<number, ProductGroup>();
  const standaloneItems: ListingItem[] = [];
  const variationBlingIds = new Set<number>();
  const baseNameGroups = new Map<string, ListingItem[]>();

  for (const item of allListingItems) {
    const { parentBlingId, baseName, attributes, hasAttributes } = extractParentInfoFromName(item.nome);
    if (parentBlingId) {
      variationBlingIds.add(item.id);
      if (!groups.has(parentBlingId)) groups.set(parentBlingId, { parentBlingId, parentListItem: null, variationItems: [], isSimple: false });
      groups.get(parentBlingId)!.variationItems.push({ blingId: item.id, name: baseName, attributes });
    } else if (hasAttributes) {
      const key = baseName.toLowerCase().trim();
      if (!baseNameGroups.has(key)) baseNameGroups.set(key, []);
      baseNameGroups.get(key)!.push(item);
      variationBlingIds.add(item.id);
    } else {
      standaloneItems.push(item);
    }
  }

  for (const item of standaloneItems) {
    const key = item.nome.toLowerCase().trim();
    if (baseNameGroups.has(key)) {
      const childItems = baseNameGroups.get(key)!;
      groups.set(item.id, { parentBlingId: item.id, parentListItem: item, variationItems: childItems.map(child => { const p = extractParentInfoFromName(child.nome); return { blingId: child.id, name: p.baseName, attributes: p.attributes }; }), isSimple: false });
      baseNameGroups.delete(key);
    } else if (groups.has(item.id)) {
      groups.get(item.id)!.parentListItem = item;
    } else {
      groups.set(item.id, { parentBlingId: item.id, parentListItem: item, variationItems: [], isSimple: true });
    }
  }

  for (const [, childItems] of baseNameGroups) {
    if (childItems.length > 0) {
      const firstChild = childItems[0];
      groups.set(firstChild.id, { parentBlingId: firstChild.id, parentListItem: null, variationItems: childItems.map(child => { const p = extractParentInfoFromName(child.nome); return { blingId: child.id, name: p.baseName, attributes: p.attributes }; }), isSimple: false });
    }
  }

  // PHASE 3: Process groups
  const { data: existingProducts } = await supabase
    .from("products")
    .select("id, bling_product_id, is_active")
    .eq("tenant_id", tenantId)
    .not("bling_product_id", "is", null);
  const existingBlingIds = new Set((existingProducts || []).map((p: any) => p.bling_product_id));
  // Build inactive set
  const inactiveBlingIds = new Set((existingProducts || []).filter((p: any) => p.is_active === false).map((p: any) => p.bling_product_id));

  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const aExists = existingBlingIds.has(a[0]); const bExists = existingBlingIds.has(b[0]);
    if (!aExists && bExists) return -1; if (aExists && !bExists) return 1; return 0;
  });

  // Modo "só produtos novos": processar apenas grupos que ainda não existem no site
  const groupsToProcess = newOnly
    ? sortedGroups.filter(([parentBlingId]) => !existingBlingIds.has(parentBlingId))
    : sortedGroups;

  let processableGroups = groupsToProcess;
  if (batchOffset > 0) processableGroups = processableGroups.slice(batchOffset);
  if (batchLimit > 0) processableGroups = processableGroups.slice(0, batchLimit);

  const processedParentIds = new Set<number>();

  for (const [parentBlingId, group] of processableGroups) {
    if (processedParentIds.has(parentBlingId)) continue;
    processedParentIds.add(parentBlingId);

    // CRITICAL: Skip inactive products — never sync with Bling
    if (inactiveBlingIds.has(parentBlingId)) {
      totalSkipped++;
      syncLog.push({ bling_id: parentBlingId, name: group.parentListItem?.nome || `ID ${parentBlingId}`, status: 'ignored_inactive', message: 'Produto inativo no site — ignorado completamente', variants: 0 });
      continue;
    }

    // For non-first-import: skip existing simple products (stock via webhook/cron)
    if (!isFirstImport && existingBlingIds.has(parentBlingId)) {
      if (group.isSimple) {
        totalSkipped++;
        syncLog.push({ bling_id: parentBlingId, name: group.parentListItem?.nome || `ID ${parentBlingId}`, status: 'skipped', message: 'Produto simples já existe (estoque via webhook)', variants: 0 });
        continue;
      }
    }

    try {
      await sleep(BLING_RATE_LIMIT_MS);
      const detailRes = await fetchWithRateLimit(`${BLING_API_URL}/produtos/${parentBlingId}`, { headers });
      if (!detailRes.ok) {
        syncLog.push({ bling_id: parentBlingId, name: group.parentListItem?.nome || `ID ${parentBlingId}`, status: 'error', message: `API retornou ${detailRes.status}`, variants: 0 });
        totalErrors++; continue;
      }
      const detailJson = await detailRes.json();
      let parentDetail = detailJson?.data;

      if (!parentDetail) {
        if (group.variationItems.length > 0) {
          await sleep(BLING_RATE_LIMIT_MS);
          const firstVarRes = await fetchWithRateLimit(`${BLING_API_URL}/produtos/${group.variationItems[0].blingId}`, { headers });
          const firstVarJson = await firstVarRes.json();
          if (firstVarJson?.data) parentDetail = { ...firstVarJson.data, nome: group.variationItems[0].name, id: parentBlingId, variacoes: [] };
          else { syncLog.push({ bling_id: parentBlingId, name: `Parent ${parentBlingId}`, status: 'error', message: 'Produto não encontrado na API', variants: 0 }); totalErrors++; continue; }
        } else { syncLog.push({ bling_id: parentBlingId, name: group.parentListItem?.nome || `ID ${parentBlingId}`, status: 'error', message: 'Detalhes não encontrados', variants: 0 }); totalErrors++; continue; }
      }

      // Resolve child → parent redirect
      if (parentDetail.formato === "V") {
        const actualParentId = parentDetail.produtoPai?.id || parentDetail.idProdutoPai;
        if (actualParentId) {
          if (processedParentIds.has(actualParentId)) { totalSkipped++; continue; }
          // Check inactive
          if (inactiveBlingIds.has(actualParentId)) { totalSkipped++; syncLog.push({ bling_id: parentBlingId, name: parentDetail.nome, status: 'ignored_inactive', message: 'Pai inativo — ignorado', variants: 0 }); continue; }
          await sleep(BLING_RATE_LIMIT_MS);
          const actualRes = await fetchWithRateLimit(`${BLING_API_URL}/produtos/${actualParentId}`, { headers });
          const actualJson = await actualRes.json();
          if (actualJson?.data) {
            parentDetail = actualJson.data;
            processedParentIds.add(actualParentId);
            const parsed = extractParentInfoFromName(group.parentListItem?.nome || "");
            if (parsed.hasAttributes) group.variationItems.push({ blingId: parentBlingId, name: parsed.baseName, attributes: parsed.attributes });
          } else { totalSkipped++; continue; }
        }
      }

      for (const vi of group.variationItems) {
        syncLog.push({ bling_id: vi.blingId, name: `${vi.name} ${vi.attributes}`, status: 'grouped', message: `Agrupado sob pai ${parentBlingId}`, variants: 0 });
      }

      const result = await upsertParentWithVariants(
        supabase,
        headers,
        parentDetail,
        parentDetail.id || parentBlingId,
        group.variationItems,
        getCategoryId,
        resolveBlingCategory,
        config,
        tenantId,
      );

      if (result.error) {
        if (result.error.includes("inativo")) {
          syncLog.push({ bling_id: parentBlingId, name: parentDetail.nome, status: 'ignored_inactive', message: result.error, variants: 0 });
          totalSkipped++;
        } else {
          syncLog.push({ bling_id: parentBlingId, name: parentDetail.nome, status: 'error', message: result.error, variants: 0 });
          totalErrors++;
        }
      } else if (result.linkedBySku) {
        syncLog.push({ bling_id: parentBlingId, name: parentDetail.nome, status: 'linked_sku', message: `Vinculado por SKU com ${result.variantCount} variação(ões)`, variants: result.variantCount });
        totalLinkedBySku++;
        totalVariants += result.variantCount;
      } else if (result.imported) {
        syncLog.push({ bling_id: parentBlingId, name: parentDetail.nome, status: 'imported', message: `Importado com ${result.variantCount} variação(ões)`, variants: result.variantCount });
        totalImported++;
        totalVariants += result.variantCount;
      } else if (result.updated) {
        syncLog.push({ bling_id: parentBlingId, name: parentDetail.nome, status: 'updated', message: `Atualizado com ${result.variantCount} variação(ões)`, variants: result.variantCount });
        totalUpdated++;
        totalVariants += result.variantCount;
      }
    } catch (err: any) {
      syncLog.push({ bling_id: parentBlingId, name: group.parentListItem?.nome || `ID ${parentBlingId}`, status: 'error', message: err.message, variants: 0 });
      totalErrors++;
    }
  }

  // PHASE 4: Clean up variations imported as standalone (modo destrutivo opcional)
  let cleaned = 0;
  if (!newOnly && BLING_ALLOW_DESTRUCTIVE_CLEANUP) {
    const { data: blingProducts } = await supabase
      .from("products")
      .select("id, bling_product_id, name")
      .eq("tenant_id", tenantId)
      .not("bling_product_id", "is", null);
    if (blingProducts?.length) {
      for (const prod of blingProducts) {
        if (variationBlingIds.has(prod.bling_product_id)) {
          // Check if any variant of this product is referenced in order_items
          const { data: variantsWithOrders } = await supabase
            .from("product_variants")
            .select("id")
            .eq("product_id", prod.id)
            .eq("tenant_id", tenantId);
          let hasOrderRefs = false;
          for (const v of (variantsWithOrders || [])) {
            const { data: orderRef } = await supabase
              .from("order_items")
              .select("id")
              .eq("product_variant_id", v.id)
              .eq("tenant_id", tenantId)
              .limit(1);
            if (orderRef?.length) { hasOrderRefs = true; break; }
          }
          if (hasOrderRefs) {
            // Deactivate instead of deleting to preserve order history
            await supabase.from("product_variants").update({ is_active: false }).eq("product_id", prod.id).eq("tenant_id", tenantId);
            await supabase.from("products").update({ is_active: false }).eq("id", prod.id).eq("tenant_id", tenantId);
            console.log(`[sync] Deactivated standalone variation product ${prod.id} (referenced in orders)`);
          } else {
            await supabase.from("product_images").delete().eq("product_id", prod.id).eq("tenant_id", tenantId);
            await supabase.from("product_variants").delete().eq("product_id", prod.id).eq("tenant_id", tenantId);
            await supabase.from("product_characteristics").delete().eq("product_id", prod.id).eq("tenant_id", tenantId);
            await supabase.from("products").delete().eq("id", prod.id).eq("tenant_id", tenantId);
          }
          cleaned++;
        }
      }
    }
  } else if (!newOnly && !BLING_ALLOW_DESTRUCTIVE_CLEANUP) {
    console.log(
      JSON.stringify({
        level: "info",
        message: "Standalone variation cleanup skipped (conservative mode)",
        context: "bling-sync.phase4",
        tenant_id: tenantId,
      }),
    );
  }

  // If this was first import, mark it and reset config to stock-only
  if (isFirstImport) {
    await supabase.from("bling_sync_config").update({
      first_import_done: true,
      sync_titles: false, sync_descriptions: false, sync_images: false,
      sync_prices: false, sync_dimensions: false, sync_sku_gtin: false,
      sync_variant_active: false,
    }).eq("tenant_id", tenantId);
    console.log("[sync] First import done — config reset to stock-only");
  }

  return {
    imported: totalImported, updated: totalUpdated, variants: totalVariants, skipped: totalSkipped,
    errors: totalErrors, cleaned, linked_by_sku: totalLinkedBySku,
    totalBlingListItems: allListingItems.length, totalGroups: sortedGroups.length,
    totalNewOnly: newOnly ? groupsToProcess.length : undefined,
    totalProcessed: processedParentIds.size,
    batchOffset, batchLimit: batchLimit || groupsToProcess.length,
    hasMore: batchLimit > 0 && (batchOffset + batchLimit) < groupsToProcess.length,
    nextOffset: batchLimit > 0 ? batchOffset + batchLimit : 0,
    log: syncLog,
  };
}

// ─── Sync Stock Only (for manual "sync stock" action — active products only) ───
async function syncStock(supabase: any, token: string, tenantId: string) {
  const correlationId = crypto.randomUUID();
  const headers = blingHeaders(token);
  const { data: allVariants } = await supabase
    .from("product_variants")
    .select("id, bling_variant_id, product_id, sku, is_active")
    .eq("tenant_id", tenantId);
  const { data: products } = await supabase
    .from("products")
    .select("id, bling_product_id, is_active, tenant_id")
    .eq("tenant_id", tenantId)
    .not("bling_product_id", "is", null);
  if (!products?.length && !allVariants?.length) return { updated: 0 };

  // Only active products
  const activeProductIds = new Set<string>();
  const productBlingMap = new Map<string, number>();
  const productTenantMap = new Map<string, string | null>();
  for (const p of (products || [])) {
    if (p.is_active === false) continue;
    activeProductIds.add(p.id);
    productBlingMap.set(p.id, p.bling_product_id);
    productTenantMap.set(p.id, (p.tenant_id as string | null) ?? null);
  }

  const activeVariantsByProduct = new Map<string, Array<{ id: string; sku: string | null; bling_variant_id: number | null }>>();
  const totalVariantsByProduct = new Map<string, number>();
  for (const v of (allVariants || [])) {
    if (!activeProductIds.has(v.product_id)) continue;
    totalVariantsByProduct.set(v.product_id, (totalVariantsByProduct.get(v.product_id) || 0) + 1);
    if (v.is_active === false) continue;
    if (!activeVariantsByProduct.has(v.product_id)) activeVariantsByProduct.set(v.product_id, []);
    activeVariantsByProduct.get(v.product_id)!.push(v);
  }

  const blingIdToVariants = new Map<number, string[]>();
  const variantIdToProductId = new Map<string, string>();
  const variantIdToSku = new Map<string, string | null>();
  const variantMatchTypeById = new Map<string, BlingStockMatchType>();
  for (const v of (allVariants || [])) {
    if (v.is_active === false) continue;
    if (v.product_id) variantIdToProductId.set(v.id, v.product_id);
    variantIdToSku.set(v.id, v.sku ?? null);
    if (!activeProductIds.has(v.product_id)) continue;
    if (v.bling_variant_id) {
      if (!blingIdToVariants.has(v.bling_variant_id)) blingIdToVariants.set(v.bling_variant_id, []);
      blingIdToVariants.get(v.bling_variant_id)!.push(v.id);
      variantMatchTypeById.set(v.id, "bling_variant_id");
    } else {
      const pbid = productBlingMap.get(v.product_id);
      if (!pbid) continue;
      const productActiveVariants = activeVariantsByProduct.get(v.product_id) || [];
      const totalVariants = totalVariantsByProduct.get(v.product_id) || productActiveVariants.length;
      if (canApplyParentStockFallback(productActiveVariants.length, totalVariants)) {
        if (!blingIdToVariants.has(pbid)) blingIdToVariants.set(pbid, []);
        blingIdToVariants.get(pbid)!.push(v.id);
        variantMatchTypeById.set(v.id, "bling_product_id_parent");
      } else {
        logBlingVariantSyncAction({
          action: "mismatch",
          context: "bling-sync.syncStock.map",
          correlation_id: correlationId,
          product_id: v.product_id,
          variant_id: v.id,
          local_sku: v.sku ?? null,
          bling_variant_id: pbid,
          reason: "missing_bling_variant_id_on_multi_variant_product",
        });
      }
    }
  }

  const allBlingIds = [...blingIdToVariants.keys()];
  if (allBlingIds.length === 0) return { updated: 0 };

  const circuit = new BlingStockCircuitBreaker(parseBlingStockCircuitConfig({
    BLING_STOCK_CIRCUIT_MISSING_SALDO_PERCENT: Deno.env.get("BLING_STOCK_CIRCUIT_MISSING_SALDO_PERCENT") ?? undefined,
    BLING_STOCK_CIRCUIT_MAX_ZERO_UPDATES: Deno.env.get("BLING_STOCK_CIRCUIT_MAX_ZERO_UPDATES") ?? undefined,
    BLING_STOCK_CIRCUIT_MIN_REQUESTED_FOR_PERCENT: Deno.env.get("BLING_STOCK_CIRCUIT_MIN_REQUESTED_FOR_PERCENT") ?? undefined,
  }));
  let circuitTripped = false;
  let circuitTripReason: string | undefined;

  let updated = 0;
  outerSync: for (let i = 0; i < allBlingIds.length; i += 50) {
    const batch = allBlingIds.slice(i, i + 50);
    const idsParam = batch.map(id => `idsProdutos[]=${id}`).join("&");
    if (i > 0) await sleep(BLING_RATE_LIMIT_MS);
    const res = await fetchWithRateLimit(`${BLING_API_URL}/estoques/saldos?${idsParam}`, { headers });
    const json = await res.json();
    if (!res.ok) {
      console.warn(JSON.stringify({
        level: "warn",
        message: "Bling batch stock request failed, no stock overwritten for this batch",
        context: "bling-sync.syncStock",
        correlation_id: correlationId,
        status: res.status,
        detail: JSON.stringify(json).substring(0, 300),
      }));
      continue;
    }
    const batchRows = json?.data || [];
    const batchAudit = auditBlingSaldosBatch(batch, batchRows);
    logBlingSaldosBatchAudit(batchAudit, "bling-sync.syncStock", {
      correlation_id: correlationId,
      batch_start_index: i,
    });
    circuit.recordBatchAudit(batchAudit);
    const evBatch = circuit.evaluateAfterBatch();
    if (evBatch.tripped) {
      circuitTripped = true;
      circuitTripReason = evBatch.reason;
      console.warn(JSON.stringify({
        level: "warn",
        message: "bling-sync.syncStock circuit breaker tripped (missing saldo ratio)",
        context: "bling-sync.syncStock",
        correlation_id: correlationId,
        reason: evBatch.reason,
        cumulative_requested: circuit.cumulativeRequested,
        cumulative_missing_explicit: circuit.cumulativeMissingExplicit,
      }));
      break outerSync;
    }

    const rowIds = new Set<number>();
    const qtyByBlingId = new Map<number, number>();
    for (const stock of batchRows) {
      const blingId = stock?.produto?.id;
      if (!blingId || typeof blingId !== "number") continue;
      rowIds.add(blingId);
    }
    mergeExplicitSaldosIntoMap(qtyByBlingId, batchRows, "bling-sync.syncStock.merge", false);

    for (const blingId of rowIds) {
      const qty = qtyByBlingId.get(blingId);

      const variantIds = blingIdToVariants.get(blingId);
      if (!variantIds) continue;

      const missingPartial = blingIdMissingExplicitInAudit(batchAudit, blingId);

      for (const vid of variantIds) {
        const hasRecent = await hasRecentLocalMovements(supabase, vid, 10, tenantId);
        const { data: currentVar } = await supabase
          .from("product_variants")
          .select("stock_quantity")
          .eq("id", vid)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        const oldStock = currentVar?.stock_quantity ?? 0;
        const matchType = variantMatchTypeById.get(vid) ?? "bling_variant_id";
        const resolved = resolveSafeStockUpdate({
          batchHttpOk: true,
          explicitSaldo: qty,
          inPartialBatchMissingSaldo: missingPartial && qty === undefined,
          hasRecentLocalMovement: hasRecent,
          matchType,
          oldStock,
        });
        const meta = blingVariantSyncDecisionColumns(resolved, "bling-sync.syncStock");
        if (resolved.shouldApplyStock && resolved.new_stock !== undefined) {
          await supabase
            .from("product_variants")
            .update({ stock_quantity: resolved.new_stock, ...meta })
            .eq("id", vid)
            .eq("tenant_id", tenantId);
          logBlingVariantSyncAction({
            action: "updated",
            context: "bling-sync.syncStock.apply",
            correlation_id: correlationId,
            product_id: variantIdToProductId.get(vid),
            variant_id: vid,
            local_sku: variantIdToSku.get(vid) ?? null,
            bling_variant_id: blingId,
            previous_stock: oldStock,
            new_stock: resolved.new_stock,
            decision: resolved.decision,
            match_type: resolved.match_type ?? null,
          });
          circuit.recordAppliedStockUpdate(oldStock, resolved.new_stock);
          const evZero = circuit.evaluateAfterBatch();
          if (evZero.tripped) {
            circuitTripped = true;
            circuitTripReason = evZero.reason;
            console.warn(JSON.stringify({
              level: "warn",
              message: "bling-sync.syncStock circuit breaker tripped (zero updates)",
              context: "bling-sync.syncStock",
              correlation_id: correlationId,
              reason: evZero.reason,
              zero_stock_updates: circuit.zeroStockUpdates,
            }));
            break outerSync;
          }
          if (resolved.new_stock !== oldStock) {
            const productId = variantIdToProductId.get(vid);
            const tenantId = productId ? productTenantMap.get(productId) ?? null : null;
            if (!tenantId) {
              console.warn("[bling-sync] Missing tenant_id for inventory_movements insert", {
                product_id: productId,
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
          await supabase.from("product_variants").update(meta).eq("id", vid).eq("tenant_id", tenantId);
          logBlingVariantSyncAction({
            action: "skipped",
            context: "bling-sync.syncStock.apply",
            correlation_id: correlationId,
            product_id: variantIdToProductId.get(vid),
            variant_id: vid,
            local_sku: variantIdToSku.get(vid) ?? null,
            bling_variant_id: blingId,
            previous_stock: oldStock,
            new_stock: resolved.new_stock,
            reason: resolved.skip_reason,
            decision: resolved.decision,
            match_type: resolved.match_type ?? null,
          });
          if (qty === undefined && blingId != null) {
            console.warn(JSON.stringify({
              level: "warn",
              message: "Bling stock skipped: missing explicit stock saldo fields for bling id in sync_stock batch",
              context: "bling-sync.syncStock",
              bling_produto_id: blingId,
              decision: resolved.decision,
            }));
          } else if (hasRecent) {
            console.log(`[syncStock] Skipping variant ${vid} — recent local movements`);
          }
        }
      }
    }
  }

  console.log(`Stock sync complete: ${updated} updates from ${allBlingIds.length} Bling IDs (inactive skipped)${circuitTripped ? `; circuit_tripped=${circuitTripReason}` : ""}`);
  return { updated, totalChecked: allBlingIds.length, circuit_tripped: circuitTripped, circuit_trip_reason: circuitTripReason };
}

// ─── Create Order in Bling ───
async function createOrder(supabase: any, token: string, orderId: string, tenantId: string) {
  const headers = blingHeaders(token);
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (orderError || !order) throw new Error(`Pedido não encontrado: ${orderError?.message || orderId}`);
  // Use customer_cpf column as primary source, fallback to regex in notes
  const cpfRaw = order.customer_cpf || order.notes?.match(/CPF:\s*([\d.\-]+)/)?.[1] || "";
  const cpf = cpfRaw.replace(/\D/g, "");
  const itens = [];
  for (const item of (order.order_items || [])) {
    let codigo = item.product_id?.substring(0, 8) || "PROD";
    // Priority: variant SKU > product SKU > fallback
    if (item.product_variant_id) {
      const { data: variant } = await supabase
        .from("product_variants")
        .select("sku")
        .eq("id", item.product_variant_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (variant?.sku) codigo = variant.sku;
      else if (item.product_id) {
        const { data: prod } = await supabase
          .from("products")
          .select("sku")
          .eq("id", item.product_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (prod?.sku) codigo = prod.sku;
      }
    } else if (item.product_id) {
      const { data: prod } = await supabase
        .from("products")
        .select("sku, bling_product_id")
        .eq("id", item.product_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (prod?.sku) codigo = prod.sku;
    }
    itens.push({ descricao: item.product_name, quantidade: item.quantity, valor: item.unit_price, codigo });
  }
  const blingOrder = {
    numero: 0, data: new Date(order.created_at).toISOString().split("T")[0],
    dataSaida: new Date().toISOString().split("T")[0],
    contato: { nome: order.shipping_name, tipoPessoa: "F", numeroDocumento: cpf, contribuinte: 9 },
    itens,
    transporte: {
      fretePorConta: 0, frete: order.shipping_cost || 0, volumes: [{ servico: "Transportadora" }],
      contato: { nome: order.shipping_name },
      etiqueta: { nome: order.shipping_name, endereco: order.shipping_address, municipio: order.shipping_city, uf: order.shipping_state, cep: order.shipping_zip?.replace(/\D/g, "") },
    },
    parcelas: [{ valor: order.total_amount, dataVencimento: new Date().toISOString().split("T")[0], observacao: "Pagamento online" }],
    observacoes: `Pedido ${order.order_number} - Loja Online`, observacoesInternas: order.notes || "", numeroPedidoCompra: order.order_number,
  };
  const response = await fetchWithTimeout(`${BLING_API_URL}/pedidos/vendas`, { method: "POST", headers, body: JSON.stringify(blingOrder) });
  const data = await response.json();
  if (!response.ok) throw new Error(`Bling API error [${response.status}]: ${JSON.stringify(data)}`);
  return { bling_order_id: data?.data?.id };
}

async function generateNfe(token: string, blingOrderId: number) {
  const headers = blingHeaders(token);
  const response = await fetchWithTimeout(`${BLING_API_URL}/nfe`, { method: "POST", headers, body: JSON.stringify({ tipo: 1, idPedidoVenda: blingOrderId }) });
  const data = await response.json();
  if (!response.ok) throw new Error(`Bling NF-e error [${response.status}]: ${JSON.stringify(data)}`);
  const nfeId = data?.data?.id;
  if (nfeId) await fetchWithTimeout(`${BLING_API_URL}/nfe/${nfeId}/enviar`, { method: "POST", headers });
  return { nfe_id: nfeId };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ─── Bug 1 Fix: Add admin authentication ───
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createSupabase();

    const body = await req.json();
    const { action, ...payload } = body;
    const requestedTenantId = parseRequestedTenantId(req, body);
    const tenantCtx = await resolveAdminTenantContext(supabase, user.id, requestedTenantId);
    const tenantId = tenantCtx.tenantId;

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      // Also check admin_members
      const { data: memberData } = await supabase
        .from("admin_members")
        .select("role, is_active")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .in("role", ["super_admin", "owner", "manager", "operator", "admin"])
        .eq("is_active", true)
        .maybeSingle();
      if (!memberData) {
        return new Response(JSON.stringify({ error: "Acesso negado: apenas administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const token = await getValidToken(supabase, tenantId);
    const config = await getSyncConfig(supabase, { tenantId });
    let result: any;

    switch (action) {
      case "list_stores": {
        const storesHeaders = blingHeaders(token);
        const stores: any[] = [];
        try {
          const res = await fetchWithTimeout(`${BLING_API_URL}/canais-de-venda`, { headers: storesHeaders });
          const json = await res.json();
          if (res.ok && json?.data?.length) for (const ch of json.data) stores.push({ id: ch.id, name: ch.descricao || ch.nome || `Canal ${ch.id}`, type: ch.tipo || 'loja_virtual' });
        } catch (_) {}
        if (stores.length === 0) {
          try {
            const res = await fetchWithTimeout(`${BLING_API_URL}/lojas-virtuais`, { headers: storesHeaders });
            const json = await res.json();
            if (res.ok && json?.data?.length) for (const s of json.data) stores.push({ id: s.id, name: s.descricao || s.nome || `Loja ${s.id}`, type: 'loja_virtual' });
          } catch (_) {}
        }
        result = { stores };
        break;
      }

      case "sync_products":
        result = await syncProducts(
          supabase,
          token,
          config,
          tenantId,
          payload.limit || 0,
          payload.offset || 0,
          false,
          !!payload.new_only,
        );
        break;

      case "first_import":
        result = await syncProducts(
          supabase,
          token,
          { ...config, import_new_products: true, merge_by_sku: true },
          tenantId,
          payload.limit || 0,
          payload.offset || 0,
          true,
        );
        break;

      case "sync_stock":
        result = await syncStock(supabase, token, tenantId);
        break;

      case "get_sync_config":
        result = config;
        break;

      case "debug_product": {
        if (!payload.search) throw new Error("Informe o campo 'search'");
        const headers = blingHeaders(token);
        const searchUrl = `${BLING_API_URL}/produtos?pesquisa=${encodeURIComponent(payload.search)}&limite=5`;
        const searchRes = await fetchWithRateLimit(searchUrl, { headers });
        const searchJson = await searchRes.json();
        const listings = searchJson?.data || [];
        const debugInfo: any = { listings: listings.map((p: any) => ({ id: p.id, nome: p.descricao || p.nome, formato: p.formato })) };
        if (listings.length > 0) {
          await sleep(BLING_RATE_LIMIT_MS);
          const detailRes = await fetchWithRateLimit(`${BLING_API_URL}/produtos/${listings[0].id}`, { headers });
          const detailJson = await detailRes.json();
          const bp = detailJson?.data;
          debugInfo.detail = { id: bp?.id, nome: bp?.nome, formato: bp?.formato, situacao: bp?.situacao, codigo: bp?.codigo, preco: bp?.preco, categoria: bp?.categoria, produtoPai: bp?.produtoPai || bp?.idProdutoPai, variacoesCount: bp?.variacoes?.length || 0 };
        }
        result = debugInfo;
        break;
      }

      case "relink_variants": {
        const relinkLimit = payload.limit || 30;
        const relinkOffset = payload.offset || 0;
        const { data: unlinkedVariants } = await supabase
          .from("product_variants")
          .select("id, sku, product_id, is_active")
          .eq("tenant_id", tenantId)
          .is("bling_variant_id", null)
          .not("sku", "is", null);
        const { data: linkedProducts } = await supabase
          .from("products")
          .select("id, bling_product_id, is_active")
          .eq("tenant_id", tenantId)
          .not("bling_product_id", "is", null);
        const prodBlingMap = new Map<string, number>();
        const activeProductIds = new Set<string>();
        for (const p of (linkedProducts || [])) {
          if (p.is_active === false) continue; // Skip inactive
          prodBlingMap.set(p.id, p.bling_product_id);
          activeProductIds.add(p.id);
        }
        let linked = 0, stockUpdated = 0;
        const relinkCorrelationId = crypto.randomUUID();
        const relinkHeaders = blingHeaders(token);
        const processedParents = new Set<number>();
        const relinkLog: Array<{ sku: string; bling_variant_id: number | null; stock: number | null; status: string }> = [];
        const varsByProduct = new Map<string, Array<{ id: string; sku: string }>>();
        for (const v of (unlinkedVariants || [])) {
          if (v.is_active === false) continue;
          if (!v.sku || !activeProductIds.has(v.product_id)) continue; // Skip inactive
          if (!varsByProduct.has(v.product_id)) varsByProduct.set(v.product_id, []);
          varsByProduct.get(v.product_id)!.push({ id: v.id, sku: v.sku });
        }
        const productEntries = [...varsByProduct.entries()];
        const batchEntries = productEntries.slice(relinkOffset, relinkOffset + relinkLimit);
        for (const [productId, variants] of batchEntries) {
          const parentBlingId = prodBlingMap.get(productId);
          if (!parentBlingId || processedParents.has(parentBlingId)) continue;
          processedParents.add(parentBlingId);
          try {
            await sleep(BLING_RATE_LIMIT_MS);
            const detailRes = await fetchWithRateLimit(`${BLING_API_URL}/produtos/${parentBlingId}`, { headers: relinkHeaders });
            if (!detailRes.ok) continue;
            const detailJson = await detailRes.json();
            const detail = detailJson?.data;
            if (!detail?.variacoes?.length) continue;
            const skuToBlingIdNorm = new Map<string, number>();
            for (const v of detail.variacoes) {
              if (v.codigo) skuToBlingIdNorm.set(normalizeBlingSku(v.codigo), v.id);
            }
            const variantRowsForEval = variants.map((x: { id: string; sku: string }) => ({ id: x.id, sku: x.sku }));
            for (const localVar of variants) {
              const ev = evaluateSkuRelinkOnProduct(variantRowsForEval, localVar.sku);
              if (!ev.ok) {
                relinkLog.push({ sku: localVar.sku, bling_variant_id: null, stock: null, status: `skipped_${ev.reason}` });
                continue;
              }
              if (ev.variantId !== localVar.id) continue;
              const blingVarId = skuToBlingIdNorm.get(normalizeBlingSku(localVar.sku));
              if (blingVarId) {
                await supabase
                  .from("product_variants")
                  .update({ bling_variant_id: blingVarId })
                  .eq("id", localVar.id)
                  .eq("tenant_id", tenantId);
                linked++;
                relinkLog.push({ sku: localVar.sku, bling_variant_id: blingVarId, stock: null, status: "linked" });
              } else relinkLog.push({ sku: localVar.sku, bling_variant_id: null, stock: null, status: "no_match" });
            }
            const varIds = detail.variacoes.map((v: any) => v.id);
            const idsParam = varIds.map((id: number) => `idsProdutos[]=${id}`).join("&");
            await sleep(BLING_RATE_LIMIT_MS);
            const stockRes = await fetchWithRateLimit(`${BLING_API_URL}/estoques/saldos?${idsParam}`, { headers: relinkHeaders });
            if (!stockRes.ok) {
              const t = await stockRes.text();
              console.warn(JSON.stringify({
                level: "warn",
                message: "Bling batch stock request failed during relink, no stock overwritten",
                context: "bling-sync.relink_variants",
                status: stockRes.status,
                body: t.substring(0, 300),
              }));
            } else {
              const stockJson = await stockRes.json();
              const relinkRows = stockJson?.data || [];
              const relinkAudit = auditBlingSaldosBatch(varIds, relinkRows);
              const relinkRowIds = new Set<number>();
              const relinkQtyById = new Map<number, number>();
              for (const s of relinkRows) {
                const bId = s?.produto?.id;
                if (!bId || typeof bId !== "number") continue;
                relinkRowIds.add(bId);
              }
              mergeExplicitSaldosIntoMap(relinkQtyById, relinkRows, "bling-sync.relink_variants.merge", false);
              for (const bId of relinkRowIds) {
                const qty = relinkQtyById.get(bId);
                const { data: lv } = await supabase
                  .from("product_variants")
                  .select("id, is_active, sku")
                  .eq("bling_variant_id", bId)
                  .eq("tenant_id", tenantId)
                  .maybeSingle();
                if (lv) {
                  if (lv.is_active === false) {
                    logBlingVariantSyncAction({
                      action: "skipped",
                      context: "bling-sync.relink_variants",
                      correlation_id: relinkCorrelationId,
                      product_id: productId,
                      variant_id: lv.id,
                      local_sku: lv.sku ?? null,
                      bling_variant_id: bId,
                      reason: "matched_inactive_variant",
                    });
                    continue;
                  }
                  const hasRecent = await hasRecentLocalMovements(supabase, lv.id, 10, tenantId);
                  const { data: oldVar } = await supabase
                    .from("product_variants")
                    .select("stock_quantity")
                    .eq("id", lv.id)
                    .eq("tenant_id", tenantId)
                    .maybeSingle();
                  const oldQty = oldVar?.stock_quantity ?? 0;
                  const missingPartial = blingIdMissingExplicitInAudit(relinkAudit, bId);
                  const resolved = resolveSafeStockUpdate({
                    batchHttpOk: true,
                    explicitSaldo: qty,
                    inPartialBatchMissingSaldo: missingPartial && qty === undefined,
                    hasRecentLocalMovement: hasRecent,
                    matchType: "bling_variant_id",
                    oldStock: oldQty,
                  });
                  const meta = blingVariantSyncDecisionColumns(resolved, "bling-sync.relink_variants");
                  if (resolved.shouldApplyStock && resolved.new_stock !== undefined) {
                    await supabase
                      .from("product_variants")
                      .update({ stock_quantity: resolved.new_stock, ...meta })
                      .eq("id", lv.id)
                      .eq("tenant_id", tenantId);
                    stockUpdated++;
                    if (resolved.new_stock !== oldQty) {
                      const { data: pvRow } = await supabase
                        .from("product_variants")
                        .select("product_id")
                        .eq("id", lv.id)
                        .eq("tenant_id", tenantId)
                        .maybeSingle();

                      const productId = pvRow?.product_id;
                      if (!productId) {
                        console.warn("[bling-sync] Missing product_id for inventory_movements insert", {
                          variant_id: lv.id,
                        });
                      } else {
                        const { data: prow2 } = await supabase
                          .from("products")
                          .select("tenant_id")
                          .eq("id", productId)
                          .eq("tenant_id", tenantId)
                          .maybeSingle();

                        const resolvedTenantId: string | undefined = prow2?.tenant_id;
                        if (!resolvedTenantId) {
                          console.warn("[bling-sync] Missing tenant_id for inventory_movements insert", {
                            product_id: productId,
                            variant_id: lv.id,
                          });
                        } else {
                          await supabase.from("inventory_movements").insert({
                            tenant_id: resolvedTenantId,
                            variant_id: lv.id,
                            quantity: resolved.new_stock - oldQty,
                            type: "bling_sync",
                          }).then(() => {}, () => {});
                        }
                      }
                    }
                  } else {
                    await supabase.from("product_variants").update(meta).eq("id", lv.id).eq("tenant_id", tenantId);
                    if (hasRecent) console.log(`[relink] Skipping stock overwrite for variant ${lv.id} — recent local movements`);
                  }
                }
              }
            }
          } catch (err: any) { console.error(`[relink] Error for parent ${parentBlingId}:`, err.message); }
        }
        result = { linked, stockUpdated, totalUnlinked: unlinkedVariants?.length || 0, totalProductGroups: productEntries.length, hasMore: (relinkOffset + relinkLimit) < productEntries.length, nextOffset: (relinkOffset + relinkLimit) < productEntries.length ? relinkOffset + relinkLimit : 0, log: relinkLog.slice(0, 50) };
        break;
      }

      case "cleanup_variations": {
        const { data: variationProducts } = await supabase
          .from("products")
          .select("id, name, bling_product_id")
          .eq("tenant_id", tenantId)
          .or("name.like.%Cor:%,name.like.%Tamanho:%");
        let cleanedCount = 0;

        if (variationProducts && variationProducts.length > 0) {
          const productIdsToDelete: string[] = [];
          const CHUNK_SIZE = 100;

          // Phase 1: Identify which products have a corresponding variant
          for (let i = 0; i < variationProducts.length; i += CHUNK_SIZE) {
            const chunk = variationProducts.slice(i, i + CHUNK_SIZE);
            const blingIds = chunk.map(p => p.bling_product_id).filter(Boolean);

            if (blingIds.length > 0) {
              const { data: existingVariants } = await supabase
                .from("product_variants")
                .select("bling_variant_id")
                .eq("tenant_id", tenantId)
                .in("bling_variant_id", blingIds);

              const existingBlingIds = new Set((existingVariants || []).map((v: any) => v.bling_variant_id));

              const chunkIdsToDelete = chunk
                .filter(p => p.bling_product_id && existingBlingIds.has(p.bling_product_id))
                .map(p => p.id);

              if (chunkIdsToDelete.length > 0) {
                productIdsToDelete.push(...chunkIdsToDelete);
              }
            }
          }

          // Phase 2: Batch delete the identified products and their related records
          if (productIdsToDelete.length > 0) {
            for (let i = 0; i < productIdsToDelete.length; i += CHUNK_SIZE) {
              const chunkIds = productIdsToDelete.slice(i, i + CHUNK_SIZE);

              // Check for order_items references before deleting variants
              const safeToDeleteProductIds: string[] = [];
              const deactivateProductIds: string[] = [];
              for (const pid of chunkIds) {
                const { data: prodVariants } = await supabase
                  .from("product_variants")
                  .select("id")
                  .eq("product_id", pid)
                  .eq("tenant_id", tenantId);
                const varIds = (prodVariants || []).map((v: any) => v.id);
                let hasOrderRef = false;
                if (varIds.length > 0) {
                  const { data: orderRefs } = await supabase
                    .from("order_items")
                    .select("id")
                    .in("product_variant_id", varIds)
                    .eq("tenant_id", tenantId)
                    .limit(1);
                  hasOrderRef = (orderRefs?.length || 0) > 0;
                }
                if (hasOrderRef) {
                  deactivateProductIds.push(pid);
                } else {
                  safeToDeleteProductIds.push(pid);
                }
              }
              // Deactivate products with order references
              if (deactivateProductIds.length > 0) {
                await supabase.from("product_variants").update({ is_active: false }).eq("tenant_id", tenantId).in("product_id", deactivateProductIds);
                await supabase.from("products").update({ is_active: false }).eq("tenant_id", tenantId).in("id", deactivateProductIds);
                console.log(`[cleanup_variations] Deactivated ${deactivateProductIds.length} products (referenced in orders)`);
              }
              // Delete products without order references
              if (safeToDeleteProductIds.length > 0) {
                await Promise.all([
                  supabase.from("product_images").delete().eq("tenant_id", tenantId).in("product_id", safeToDeleteProductIds),
                  supabase.from("product_variants").delete().eq("tenant_id", tenantId).in("product_id", safeToDeleteProductIds),
                  supabase.from("product_characteristics").delete().eq("tenant_id", tenantId).in("product_id", safeToDeleteProductIds),
                  supabase
                    .from("buy_together_products")
                    .delete()
                    .eq("tenant_id", tenantId)
                    .or(`product_id.in.(${safeToDeleteProductIds.join(',')}),related_product_id.in.(${safeToDeleteProductIds.join(',')})`),
                ]);
                await supabase.from("products").delete().eq("tenant_id", tenantId).in("id", safeToDeleteProductIds);
              }

              cleanedCount += chunkIds.length;
            }
          }
        }

        result = { cleaned: cleanedCount };
        break;
      }

      case "create_order": {
        // Bug 6 Fix: Check for duplicate and save bling_order_id
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id, bling_order_id")
          .eq("id", payload.order_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (existingOrder?.bling_order_id) {
          result = { bling_order_id: existingOrder.bling_order_id, duplicate: true };
        } else {
          const orderResult = await createOrder(supabase, token, payload.order_id, tenantId);
          // Save bling_order_id back to order (dedicated column)
          if (orderResult.bling_order_id) {
            await supabase.from("orders").update({
              bling_order_id: orderResult.bling_order_id,
            }).eq("id", payload.order_id).eq("tenant_id", tenantId);
          }
          result = orderResult;
        }
        break;
      }
      case "generate_nfe": result = await generateNfe(token, parseInt(payload.bling_order_id)); break;
      case "order_to_nfe": {
        // Check for existing bling_order_id to avoid duplicates
        const { data: nfeOrder } = await supabase
          .from("orders")
          .select("id, bling_order_id")
          .eq("id", payload.order_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        let orderResult;
        if (nfeOrder?.bling_order_id) {
          orderResult = { bling_order_id: nfeOrder.bling_order_id, duplicate: true };
        } else {
          orderResult = await createOrder(supabase, token, payload.order_id, tenantId);
          if (orderResult.bling_order_id) {
            await supabase.from("orders").update({
              bling_order_id: orderResult.bling_order_id,
            }).eq("id", payload.order_id).eq("tenant_id", tenantId);
          }
        }
        const nf = await generateNfe(token, orderResult.bling_order_id);
        result = { ...orderResult, ...nf };
        break;
      }
      default: return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Bling sync error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro na integração com Bling" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
