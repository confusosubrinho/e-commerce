/**
 * PR4: Checkout router mínimo — delega para implementações existentes e retorna shape unificado.
 * PR9 Fase 1: route "start" — schema rígido (zod), preços/totais recalculados no servidor, allowlist, rate limit.
 * Fase 8 mt-backend: lê tenant_id da requisição (x-tenant-id ou body.tenant_id), usa em inserts e repassa às funções downstream.
 */
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getTenantIdFromRequest } from "../_shared/tenant.ts";
import {
  validateCouponAndComputeDiscount,
  type CouponRow,
  type CheckoutItem,
} from "../_shared/yampiCheckoutPricing.ts";

const SINGLETON_ID = "00000000-0000-0000-0000-000000000001";

const ROUTES = [
  "start",
  "resolve",
  "create_gateway_session",
  "stripe_intent",
  "process_payment",
] as const;

type Route = (typeof ROUTES)[number];

const TARGET_MAP: Record<Exclude<Route, "start">, string> = {
  resolve: "checkout-create-session",
  create_gateway_session: "checkout-create-session",
  stripe_intent: "checkout-stripe-create-intent",
  process_payment: "checkout-process-payment",
};

// Allowlist e schema por route. Para "start" não aceitamos unit_price/product_name/subtotal/total_amount do cliente.
const startStartItemSchema = z.object({
  variant_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});
const startStartSchema = z.object({
  route: z.literal("start"),
  cart_id: z.string().min(1),
  items: z.array(startStartItemSchema).min(1),
  /**
   * @deprecated Aceito mas IGNORADO pelo servidor para o path Yampi.
   * O desconto é recalculado server-side a partir do coupon_code (DB).
   * Para Stripe, o checkout-stripe-create-intent re-valida independentemente.
   * Mantido no schema apenas para compatibilidade retroativa com o frontend.
   */
  discount_amount: z.number().min(0).optional().default(0),
  shipping_cost: z.number().min(0).optional().default(0),
  success_url: z.union([z.string().url(), z.literal("")]).optional().default(""),
  cancel_url: z.union([z.string().url(), z.literal("")]).optional().default(""),
  attribution: z.unknown().optional(),
  user_id: z.string().uuid().nullable().optional(),
  order_access_token: z.string().nullable().optional(),
  coupon_code: z.string().nullable().optional(),
  request_id: z.string().optional(),
});

// Rate limit DB-backed: evita bypass em cold-start (Edge Functions stateless).
// Identificador: cart_id|IP
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 30;

function jsonRes(body: Record<string, unknown>, status = 200, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = {
    ...getCorsHeaders(req.headers.get("Origin")),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-request-id, x-tenant-id, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ success: false, error: "Method not allowed" }, 405, corsHeaders);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("checkout-router: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return jsonRes({ success: false, error: "Configuração do servidor incompleta" }, 500, corsHeaders);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    return jsonRes({ success: false, error: "Body JSON inválido" }, 400, corsHeaders);
  }

  const tenantId = getTenantIdFromRequest(req, body);
  const route = (body?.route ?? body?.action) as Route | undefined;
  const requestId = (body?.request_id as string) || req.headers.get("x-request-id") || null;

  if (!route || !ROUTES.includes(route)) {
    return jsonRes(
      { success: false, error: "route inválida. Use: start | resolve | create_gateway_session | stripe_intent | process_payment" },
      400,
      corsHeaders
    );
  }

  // ─── PR9: route "start" — validação rígida, preços do DB, rate limit ───
  if (route === "start") {
    const parsed = startStartSchema.safeParse({ ...body, route: "start" });
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join("; ") || "Payload inválido para route start";
      return jsonRes({ success: false, error: msg }, 400, corsHeaders);
    }
    const startReq = parsed.data;
    const cartId = startReq.cart_id;
    const itemsInput = startReq.items;
    const discountAmount = startReq.discount_amount ?? 0;
    const shippingCost = startReq.shipping_cost ?? 0;
    const successUrl = startReq.success_url ?? "";
    const cancelUrl = startReq.cancel_url ?? "";
    const orderAccessToken = startReq.order_access_token ?? null;
    const userId = startReq.user_id ?? null;
    const couponCode = startReq.coupon_code ?? null;
    const attribution = startReq.attribution;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const rateKey = `${cartId}|${ip}`;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const rateIdentifier = `checkout_router:${rateKey}`;
    try {
      const { data: allowed, error: rlErr } = await supabase.rpc("rate_limit_check_and_log", {
        p_identifier: rateIdentifier,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
        p_max: RATE_LIMIT_MAX,
      });
      // Fail open: se a RPC não existir ou falhar, não bloquear checkout
      if (!rlErr && allowed === false) {
        return jsonRes({ success: false, error: "Muitas requisições. Tente novamente em alguns minutos." }, 429, corsHeaders);
      }
      if (rlErr) {
        console.warn("checkout-router: rate_limit_check_and_log falhou (fail-open):", rlErr.message);
      }
    } catch (e) {
      // Fail open: se o DB de rate limit falhar, não bloquear checkout.
      console.warn("checkout-router: rate_limit_check_and_log falhou (fail-open):", (e as Error).message);
    }
    const t0 = Date.now();

    const variantIds = [...new Set(itemsInput.map((i) => i.variant_id))];
    const { data: variantsRows, error: variantsErr } = await supabase
      .from("product_variants")
      .select("id, product_id, base_price, sale_price, yampi_sku_id, size, color, sku, products(base_price, sale_price, name)")
      .in("id", variantIds);

    if (variantsErr || !variantsRows?.length) {
      return jsonRes({ success: false, error: "Variantes não encontradas ou inválidas" }, 400, corsHeaders);
    }

    type VariantRow = {
      id: string;
      product_id: string | null;
      base_price: number | null;
      sale_price: number | null;
      yampi_sku_id: number | null;
      size: string | null;
      color: string | null;
      sku: string | null;
      products: { base_price?: number; sale_price?: number; name?: string } | null;
    };
    const variantMap = new Map<string, { product_id: string | null; name: string; unit_price: number; yampi_sku_id: number | null; size: string | null; color: string | null; sku: string | null }>();
    for (const v of variantsRows as VariantRow[]) {
      const product = v.products;
      const base = v.base_price ?? product?.base_price ?? 0;
      const sale = v.sale_price ?? product?.sale_price ?? null;
      const unitPrice = typeof sale === "number" && sale >= 0 ? sale : (typeof base === "number" ? base : 0);
      const name = (product?.name as string) ?? "";
      variantMap.set(v.id, { product_id: v.product_id ?? null, name, unit_price: Number(unitPrice), yampi_sku_id: v.yampi_sku_id ?? null, size: v.size ?? null, color: v.color ?? null, sku: v.sku ?? null });
    }

    // Fetch primary images for each product
    const productIds = [...new Set([...variantMap.values()].map(v => v.product_id).filter(Boolean))] as string[];
    const productImageMap = new Map<string, string>();
    if (productIds.length) {
      const { data: images } = await supabase
        .from("product_images")
        .select("product_id, url")
        .in("product_id", productIds)
        .eq("is_primary", true);
      for (const img of images || []) {
        if (img.product_id && img.url) productImageMap.set(img.product_id, img.url);
      }
    }

    const items: Array<CheckoutItem> = [];
    let subtotal = 0;
    for (const i of itemsInput) {
      const meta = variantMap.get(i.variant_id);
      if (!meta) {
        return jsonRes({ success: false, error: `Variante inválida: ${i.variant_id}` }, 400, corsHeaders);
      }
      const unitPrice = meta.unit_price;
      subtotal += unitPrice * i.quantity;
      items.push({
        variant_id: i.variant_id,
        quantity: i.quantity,
        unit_price: unitPrice,
        product_name: meta.name,
        product_id: meta.product_id,
      });
    }
    subtotal = Math.round(subtotal * 100) / 100;

    // ─── Validação server-side do cupom ────────────────────────────────────────
    // O discount_amount do frontend é IGNORADO; o backend recalcula a partir do DB.
    let discountAmount = 0;
    let validatedCouponId: string | null = null;
    let isFreeShippingCoupon = false;

    if (couponCode) {
      const { data: couponRow } = await supabase
        .from("coupons")
        .select(
          "id, code, type, discount_type, discount_value, min_purchase_amount, applicable_product_ids, applicable_category_id, exclude_sale_products, max_uses, current_uses, expiry_date, start_date, is_active",
        )
        .eq("code", couponCode.toUpperCase())
        .maybeSingle();

      if (couponRow) {
        // Para restrição por categoria: resolve category_id de cada produto
        const categoryMap = new Map<string, string | null>();
        if (couponRow.applicable_category_id) {
          const prodIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
          if (prodIds.length > 0) {
            const { data: prodRows } = await supabase
              .from("products")
              .select("id, category_id")
              .in("id", prodIds);
            for (const p of prodRows ?? []) {
              categoryMap.set(p.id, p.category_id ?? null);
            }
          }
        }

        const couponResult = validateCouponAndComputeDiscount(
          couponRow as CouponRow,
          items,
          subtotal,
          categoryMap,
        );
        discountAmount = couponResult.discount_amount;
        validatedCouponId = couponResult.coupon_id;
        isFreeShippingCoupon = couponResult.is_free_shipping;

        if (couponResult.rejection_reason) {
          console.warn(
            JSON.stringify({
              level: "warn",
              message: "Coupon rejected server-side",
              context: "checkout-router.start",
              coupon_code: couponCode,
              reason: couponResult.rejection_reason,
              request_id: requestId,
            }),
          );
        }
      } else {
        console.warn(
          JSON.stringify({
            level: "warn",
            message: "Coupon not found or inactive",
            context: "checkout-router.start",
            coupon_code: couponCode,
            request_id: requestId,
          }),
        );
      }
    }

    // Frete: valor vindo do frontend (cotado previamente via calculate-shipping).
    // Para frete grátis por cupom, zerado aqui; caso contrário, aceito como informado.
    const shippingFinal = isFreeShippingCoupon ? 0 : Math.max(0, shippingCost);
    const totalAmount = Math.max(
      0,
      Math.round((subtotal - discountAmount + shippingFinal) * 100) / 100,
    );

    let provider: "stripe" | "yampi" | "appmax" = "stripe";
    let channel: "internal" | "external" = "internal";
    let experience: "transparent" | "native" = "transparent";

    const { data: settings } = await supabase
      .from("checkout_settings")
      .select("enabled, active_provider, channel, experience")
      .eq("id", SINGLETON_ID)
      .maybeSingle();

    if (settings) {
      if (!settings.enabled) {
        return jsonRes(
          {
            success: true,
            provider: settings.active_provider as "stripe" | "yampi" | "appmax",
            channel: settings.channel as "internal" | "external",
            experience: settings.experience as "transparent" | "native",
            action: "render",
            redirect_url: "/checkout",
            message: "Checkout desativado.",
          },
          200,
          corsHeaders
        );
      }
      provider = settings.active_provider as "stripe" | "yampi" | "appmax";
      channel = settings.channel as "internal" | "external";
      experience = settings.experience as "transparent" | "native";
    } else {
      const resolveUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/checkout-create-session`;
      const resolveRes = await fetchWithTimeout(
        resolveUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ action: "resolve", request_id: requestId }),
        },
        10_000
      );
      const resolveData = resolveRes.ok ? (await resolveRes.json().catch(() => ({}))) as Record<string, unknown> : {};
      const flow = resolveData.flow as string | undefined;
      channel = flow === "gateway" ? "external" : "internal";
      experience = channel === "external" ? "native" : "transparent";
      provider = (resolveData.provider as "stripe" | "yampi" | "appmax") || "stripe";
    }

    let orderId: string | null = null;
    let guestToken: string | null = orderAccessToken;

    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, order_number, access_token")
      .eq("cart_id", cartId)
      .in("status", ["pending", "processing"])
      .maybeSingle();

    if (existingOrder) {
      orderId = existingOrder.id;
      if (existingOrder.access_token) guestToken = existingOrder.access_token;
    } else {
      const guestTokenNew = guestToken || crypto.randomUUID();
      const { data: newOrder, error: orderErr } = await supabase
        .from("orders")
        .insert({
          tenant_id: tenantId,
          order_number: "TEMP",
          user_id: userId,
          cart_id: cartId,
          subtotal,
          shipping_cost: shippingFinal,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          status: "pending",
          shipping_name: channel === "external" ? "Aguardando checkout" : "A preencher",
          shipping_address: "A preencher",
          shipping_city: "",
          shipping_state: "XX",
          shipping_zip: "00000000",
          shipping_phone: null,
          coupon_code: couponCode,
          customer_email: null,
          idempotency_key: cartId,
          access_token: guestTokenNew,
          provider,
          gateway: provider === "stripe" ? "stripe" : null,
        })
        .select("id")
        .single();
      if (orderErr) {
        if (orderErr.code === "23505") {
          const { data: again } = await supabase.from("orders").select("id, access_token").eq("cart_id", cartId).maybeSingle();
          if (again) {
            orderId = again.id;
            guestToken = again.access_token;
          }
        }
        if (!orderId) {
          console.error("checkout-router start order insert error:", orderErr);
          return jsonRes({ success: false, error: orderErr.message }, 500, corsHeaders);
        }
      } else {
        orderId = newOrder?.id ?? null;
        guestToken = guestTokenNew;
      }
      if (orderId && newOrder && !orderErr) {
        const fullItems = items.map((i) => {
          const meta = variantMap.get(i.variant_id)!;
          const variantParts = [meta.size, meta.color].filter(Boolean);
          const variantInfo = variantParts.join(" / ");
          const imageSnapshot = meta.product_id ? (productImageMap.get(meta.product_id) || null) : null;
          return {
            order_id: orderId,
            product_variant_id: i.variant_id,
            product_id: meta.product_id,
            product_name: i.product_name,
            variant_info: variantInfo,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total_price: i.unit_price * i.quantity,
            title_snapshot: i.product_name,
            image_snapshot: imageSnapshot,
            sku_snapshot: meta.sku || null,
            yampi_sku_id: meta.yampi_sku_id,
          };
        });
        await supabase.from("order_items").insert(
          fullItems.map(({ order_id, product_variant_id, product_id, product_name, variant_info, quantity, unit_price, total_price, title_snapshot, image_snapshot, sku_snapshot, yampi_sku_id }) =>
            ({ tenant_id: tenantId, order_id, product_variant_id, product_id, product_name, variant_info, quantity, unit_price, total_price, title_snapshot, image_snapshot, sku_snapshot, yampi_sku_id })
          )
        );
      }
    }

    const origin = successUrl ? (() => { try { return new URL(successUrl).origin; } catch { return ""; } })() : "";
    const productsForStripe = items.map((i) => ({ variant_id: i.variant_id, name: i.product_name, quantity: i.quantity, unit_price: i.unit_price }));

    if (channel === "external" && provider === "yampi") {
      // Bug fix: reserve stock for Yampi external to prevent overselling
      if (orderId && !existingOrder) {
        for (const i of itemsInput) {
          const stockResult = await supabase.rpc("decrement_stock", { p_variant_id: i.variant_id, p_quantity: i.quantity });
          const stockData = stockResult.data as { success: boolean; error?: string } | null;
          if (stockData?.success) {
            await supabase.from("inventory_movements").insert({
              tenant_id: tenantId,
              variant_id: i.variant_id,
              order_id: orderId,
              type: "reserve",
              quantity: i.quantity,
            });
          } else {
            console.warn(`[checkout-router] Stock reserve failed for variant ${i.variant_id}: ${stockData?.error || "unknown"}`);
          }
        }
      }

      // ─── Criar checkout_session congelada antes de chamar a Yampi ─────────────
      // Esta sessão é a fonte de verdade do preço. O webhook valida o amount pago
      // contra checkout_sessions.total_amount antes de confirmar o pedido.
      let checkoutSessionId: string | null = null;
      const { data: sessionRecord, error: sessionErr } = await supabase
        .from("checkout_sessions")
        .insert({
          tenant_id: tenantId,
          order_id: orderId,
          items: items.map((i) => ({
            variant_id: i.variant_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            product_name: i.product_name,
            product_id: i.product_id,
          })),
          subtotal,
          discount_amount: discountAmount,
          coupon_code: couponCode ?? null,
          coupon_id: validatedCouponId,
          shipping_amount: shippingFinal,
          total_amount: totalAmount,
          status: "pending",
          correlation_id: requestId ?? null,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();

      if (sessionErr || !sessionRecord?.id) {
        console.error(
          JSON.stringify({
            level: "error",
            message: "Falha ao criar checkout_session — abortando checkout Yampi",
            context: "checkout-router.start.yampi",
            request_id: requestId,
            error: sessionErr?.message,
          }),
        );
        return jsonRes(
          { success: false, error: "Erro ao inicializar sessão de checkout. Tente novamente." },
          500,
          corsHeaders,
        );
      }

      checkoutSessionId = sessionRecord.id as string;

      // Grava checkout_session_id no pedido imediatamente (fonte de verdade)
      if (orderId) {
        await supabase
          .from("orders")
          .update({ checkout_session_id: checkoutSessionId })
          .eq("id", orderId);
      }

      const targetUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/checkout-create-session`;
      const yampiRes = await fetchWithTimeout(
        targetUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
            "x-tenant-id": tenantId,
          },
          body: JSON.stringify({
            items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
            attribution,
            request_id: requestId,
            tenant_id: tenantId,
            skip_stock_check: true,
            // Passa o ID da sessão congelada para que checkout-create-session
            // use como metadata.session_id no link Yampi (em vez de gerar um novo UUID)
            checkout_session_id: checkoutSessionId,
          }),
        },
        22_000,
      );
      const yampiData = yampiRes.ok ? (await yampiRes.json().catch(() => ({}))) as Record<string, unknown> : {};
      const redirectUrl = yampiData.redirect_url as string | undefined;
      const isFallback = yampiData.fallback === true;
      const errMsg = yampiData.error as string | undefined;

      // Se Yampi retornou fallback (e.g. yampi_sku_id faltando), renderizar checkout nativo
      if (isFallback || (redirectUrl && redirectUrl === "/checkout")) {
        console.log(JSON.stringify({ scope: "checkout-router", request_id: requestId, route: "start", provider, channel, fallback: true, reason: yampiData.fallback_reason || errMsg || "yampi_fallback", duration_ms: Date.now() - t0 }));
        // Cancela a checkout_session criada (não haverá link Yampi)
        await supabase.from("checkout_sessions").update({ status: "cancelled" }).eq("id", checkoutSessionId);
        return jsonRes(
          {
            success: true,
            provider,
            channel,
            experience,
            action: "render",
            redirect_url: "/checkout",
            order_id: orderId,
            order_access_token: guestToken,
            fallback: true,
            fallback_reason: yampiData.fallback_reason || errMsg || "Yampi não disponível para estes itens",
          },
          200,
          corsHeaders,
        );
      }

      if (errMsg && !redirectUrl) {
        await supabase.from("checkout_sessions").update({ status: "cancelled" }).eq("id", checkoutSessionId);
        return jsonRes({ success: false, provider, channel, experience, action: "redirect", error: errMsg }, 400, corsHeaders);
      }

      // O session_id retornado deve ser o mesmo que passamos (checkout_session_id)
      const yampiSessionId = (yampiData.session_id as string | undefined) ?? checkoutSessionId;
      const yampiLinkId = yampiData.yampi_link_id as string | undefined;

      if (orderId && yampiSessionId) {
        const orderUpdate: Record<string, unknown> = { checkout_session_id: yampiSessionId };
        if (yampiLinkId) orderUpdate.external_reference = String(yampiLinkId);
        await supabase.from("orders").update(orderUpdate).eq("id", orderId);
      }

      let finalSuccessUrl = successUrl;
      if (yampiSessionId && finalSuccessUrl) {
        finalSuccessUrl = finalSuccessUrl.replace("{CHECKOUT_SESSION_ID}", yampiSessionId);
      }
      const fallbackRedirect = finalSuccessUrl || `${origin}/checkout/obrigado?session_id=${yampiSessionId || ""}`;
      console.log(JSON.stringify({
        scope: "checkout-router",
        request_id: requestId,
        route: "start",
        provider,
        channel,
        checkout_session_id: checkoutSessionId,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        coupon_code: couponCode ?? null,
        duration_ms: Date.now() - t0,
      }));
      return jsonRes(
        {
          success: true,
          provider,
          channel,
          experience,
          action: "redirect",
          redirect_url: redirectUrl || fallbackRedirect,
        },
        200,
        corsHeaders,
      );
    }

    if (channel === "external" && provider === "stripe") {
      // Y46: Reserve stock atomically for Stripe external to prevent overselling (same as Yampi external)
      const reservedItems: Array<{ variant_id: string; quantity: number }> = [];
      if (orderId && !existingOrder) {
        for (const i of itemsInput) {
          const stockResult = await supabase.rpc("decrement_stock", { p_variant_id: i.variant_id, p_quantity: i.quantity });
          const stockData = stockResult.data as { success: boolean; error?: string } | null;
          if (stockData?.success) {
            reservedItems.push({ variant_id: i.variant_id, quantity: i.quantity });
            await supabase.from("inventory_movements").insert({
              tenant_id: tenantId,
              variant_id: i.variant_id,
              order_id: orderId,
              type: "reserve",
              quantity: i.quantity,
            });
          } else {
            console.warn(`[checkout-router] Stock reserve failed for variant ${i.variant_id}: ${stockData?.error || "unknown"}`);
          }
        }
      }

      const targetUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/checkout-stripe-create-intent`;
      const stripeRes = await fetchWithTimeout(
        targetUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
            "x-tenant-id": tenantId,
          },
          body: JSON.stringify({
            action: "create_checkout_session",
            order_id: orderId,
            amount: totalAmount,
            products: productsForStripe,
            coupon_code: couponCode,
            discount_amount: discountAmount,
            order_access_token: guestToken,
            success_url: successUrl || `${origin}/checkout/obrigado?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${origin}/carrinho`,
            request_id: requestId,
            tenant_id: tenantId,
          }),
        },
        22_000
      );
      const stripeData = stripeRes.ok ? (await stripeRes.json().catch(() => ({}))) as Record<string, unknown> : {};
      const checkoutUrl = stripeData.checkout_url as string | undefined;
      const errMsg = stripeData.error as string | undefined;
      const shouldFail = !stripeRes.ok || !!errMsg || !checkoutUrl;
      if (shouldFail) {
        // Compensação: se a sessão do Stripe falhar depois que reservamos estoque aqui, devemos reverter.
        if (reservedItems.length > 0 && orderId) {
          for (const item of reservedItems) {
            await supabase.rpc("increment_stock", { p_variant_id: item.variant_id, p_quantity: item.quantity });
            await supabase.from("inventory_movements").insert({
              tenant_id: tenantId,
              variant_id: item.variant_id,
              order_id: orderId,
              type: "refund",
              quantity: item.quantity,
            });
          }

          await supabase
            .from("orders")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", orderId)
            .eq("tenant_id", tenantId);
        }

        const message =
          errMsg ||
          (stripeRes.ok ? "Erro ao iniciar checkout Stripe" : stripeRes.statusText || "Erro ao iniciar checkout Stripe");
        return jsonRes(
          { success: false, provider, channel, experience, action: "redirect", error: message },
          stripeRes.ok ? 200 : stripeRes.status,
          corsHeaders
        );
      }
      console.log(JSON.stringify({ scope: "checkout-router", request_id: requestId, route: "start", provider, channel, duration_ms: Date.now() - t0 }));
      return jsonRes(
        {
          success: true,
          provider,
          channel,
          experience,
          action: "redirect",
          redirect_url: checkoutUrl,
          order_id: orderId ?? undefined,
          order_access_token: guestToken ?? undefined,
        },
        200,
        corsHeaders
      );
    }

    if (channel === "internal" && provider === "stripe") {
      const targetUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/checkout-stripe-create-intent`;
      const stripeRes = await fetchWithTimeout(
        targetUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
            "x-tenant-id": tenantId,
          },
          body: JSON.stringify({
            action: "create_payment_intent",
            order_id: orderId,
            amount: totalAmount,
            products: productsForStripe,
            coupon_code: couponCode,
            discount_amount: discountAmount,
            order_access_token: guestToken,
            request_id: requestId,
            tenant_id: tenantId,
          }),
        },
        22_000
      );
      const stripeData = stripeRes.ok ? (await stripeRes.json().catch(() => ({}))) as Record<string, unknown> : {};
      const clientSecret = stripeData.client_secret as string | undefined;
      const errMsg = stripeData.error as string | undefined;
      if (errMsg)
        return jsonRes(
          { success: false, provider, channel, experience, action: "render", error: errMsg },
          stripeRes.ok ? 200 : stripeRes.status,
          corsHeaders
        );
      console.log(JSON.stringify({ scope: "checkout-router", request_id: requestId, route: "start", provider, channel, duration_ms: Date.now() - t0 }));
      return jsonRes(
        {
          success: true,
          provider,
          channel,
          experience,
          action: "render",
          client_secret: clientSecret,
          order_id: orderId ?? undefined,
          order_access_token: guestToken ?? undefined,
        },
        200,
        corsHeaders
      );
    }

    if (channel === "internal" && provider === "appmax") {
      console.log(JSON.stringify({ scope: "checkout-router", request_id: requestId, route: "start", provider, channel, duration_ms: Date.now() - t0 }));
      return jsonRes(
        {
          success: true,
          provider,
          channel,
          experience,
          action: "render",
          order_id: orderId ?? undefined,
          order_access_token: guestToken ?? undefined,
          redirect_url: "/checkout",
        },
        200,
        corsHeaders
      );
    }

    return jsonRes(
      {
        success: false,
        provider,
        channel,
        experience,
        action: "render",
        error: "Combinação provider/channel não suportada para start",
      },
      400,
      corsHeaders
    );
  }

  const target = TARGET_MAP[route as Exclude<Route, "start">];
  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${target}`;

  const targetBody: Record<string, unknown> = { ...body, request_id: requestId, tenant_id: tenantId };
  delete targetBody.route;
  if (route === "resolve") targetBody.action = "resolve";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceRoleKey}`,
    "x-tenant-id": tenantId,
    ...(requestId && { "x-request-id": requestId }),
  };
  const auth = req.headers.get("authorization");
  if (auth) headers.Authorization = auth;

  console.log(JSON.stringify({ scope: "checkout-router", request_id: requestId, route, target }));

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify(targetBody),
      },
      22_000
    );

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return jsonRes(
        {
          success: false,
          error: res.ok ? "Resposta inválida do servidor" : `Erro ${res.status}`,
        },
        res.ok ? 502 : res.status,
        corsHeaders
      );
    }

    const errMsg = typeof data.error === "string" ? data.error : data.error != null ? JSON.stringify(data.error) : null;
    const success = res.ok && !errMsg;

    const unified = {
      success,
      ...(errMsg && { error: errMsg }),
      ...data,
    };
    return jsonRes(unified, res.ok ? 200 : res.status, corsHeaders);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("checkout-router delegate error:", msg);
    return jsonRes({ success: false, error: msg || "Erro ao processar checkout" }, 500, corsHeaders);
  }
});
