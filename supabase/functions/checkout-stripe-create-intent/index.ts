import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { DEFAULT_TENANT_ID } from "../_shared/tenant.ts";

function jsonRes(body: Record<string, unknown>, status = 200, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type CouponLineItem = {
  product_id: string;
  category_id: string | null;
  lineTotal: number;
};

function validateAndComputeCouponDiscount(
  coupon: Record<string, unknown> | null,
  lineItems: CouponLineItem[],
  subtotal: number,
  shippingState: string,
  shippingZip: string,
): { error: string | null; discount: number } {
  if (!coupon) return { error: null, discount: 0 };

  const expiryDate = coupon.expiry_date as string | null | undefined;
  if (expiryDate && new Date(expiryDate) < new Date()) {
    return { error: "Cupom expirado", discount: 0 };
  }

  const minPurchase = Number(coupon.min_purchase_amount ?? 0);
  if (minPurchase > 0 && subtotal < minPurchase) {
    return { error: `Valor mínimo para este cupom: R$ ${minPurchase}`, discount: 0 };
  }

  const rawProductIds = Array.isArray(coupon.applicable_product_ids)
    ? (coupon.applicable_product_ids as unknown[])
    : [];
  const productIds = rawProductIds.map((id) => String(id)).filter(Boolean);
  const categoryId = (coupon.applicable_category_id as string | null) ?? null;

  let applicableSubtotal = 0;
  if (productIds.length > 0) {
    const set = new Set(productIds);
    for (const item of lineItems) {
      if (set.has(item.product_id)) applicableSubtotal += item.lineTotal;
    }
  } else if (categoryId) {
    for (const item of lineItems) {
      if (item.category_id === categoryId) applicableSubtotal += item.lineTotal;
    }
  } else {
    applicableSubtotal = subtotal;
  }

  if (applicableSubtotal <= 0) {
    return { error: "Este cupom não se aplica aos produtos do pedido", discount: 0 };
  }

  const states = Array.isArray(coupon.applicable_states)
    ? (coupon.applicable_states as unknown[]).map((s) => String(s)).filter(Boolean)
    : [];
  if (states.length > 0) {
    const stateNorm = (shippingState || "").trim().toUpperCase().slice(0, 2);
    const stateMatches = stateNorm && states.some((s) => s.trim().toUpperCase().slice(0, 2) === stateNorm);
    if (!stateMatches) return { error: "Este cupom não é válido para o estado informado", discount: 0 };
  }

  const zipPrefixes = Array.isArray(coupon.applicable_zip_prefixes)
    ? (coupon.applicable_zip_prefixes as unknown[]).map((z) => String(z)).filter(Boolean)
    : [];
  if (zipPrefixes.length > 0) {
    const zipDigits = (shippingZip || "").replace(/\D/g, "");
    const zipMatches = zipDigits && zipPrefixes.some((prefix) => {
      const prefixDigits = (prefix || "").replace(/\D/g, "");
      return prefixDigits && zipDigits.startsWith(prefixDigits);
    });
    if (!zipMatches) return { error: "Este cupom não é válido para o CEP informado", discount: 0 };
  }

  const discountType = String(coupon.discount_type || "");
  const discountValue = Number(coupon.discount_value || 0);
  const discountRaw = discountType === "percentage"
    ? (applicableSubtotal * discountValue) / 100
    : discountValue;

  return { error: null, discount: Math.min(applicableSubtotal, Math.max(0, discountRaw)) };
}

Deno.serve(async (req) => {
  const corsHeaders = {
    ...getCorsHeaders(req.headers.get("Origin")),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-request-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: stripeProvider } = await supabase
      .from("integrations_checkout_providers")
      .select("config, is_active")
      .eq("provider", "stripe")
      .maybeSingle();
    const stripeConfig = (stripeProvider?.config || {}) as Record<string, unknown>;
    const secretKey = (stripeConfig.secret_key as string)?.trim() || Deno.env.get("STRIPE_SECRET_KEY") || "";

    const stripe = new Stripe(secretKey, {
      apiVersion: "2025-08-27.basil",
    });

    const body = await req.json();
    const { action } = body;
    const requestId = body?.request_id ?? req.headers.get("x-request-id") ?? null;
    console.log(JSON.stringify({ scope: "stripe-create-intent", request_id: requestId, action, order_id: body?.order_id ?? null }));

    // ─── Action: get_config ───
    if (action === "get_config") {
      return jsonRes(
        {
          publishable_key: stripeConfig.publishable_key || null,
          is_active: stripeProvider?.is_active ?? false,
        },
        200,
        corsHeaders
      );
    }

    // ─── Action: create_payment_intent ───
    if (action === "create_payment_intent") {
      const {
        order_id,
        amount,
        payment_method,
        customer_email,
        customer_name,
        products,
        coupon_code,
        discount_amount = 0,
        installments = 1,
        order_access_token,
      } = body;

      if (!order_id || !amount) {
        return jsonRes({ error: "order_id e amount são obrigatórios" }, 400, corsHeaders);
      }

      // ── Auth: Bearer or guest token ──
      const authHeader = req.headers.get("Authorization");
      const hasBearer = !!authHeader?.startsWith("Bearer ");

      if (!hasBearer) {
        if (!order_access_token) return jsonRes({ error: "Autenticação necessária" }, 401, corsHeaders);
        const { data: orderRow } = await supabase
          .from("orders")
          .select("id")
          .eq("id", order_id)
          .eq("access_token", order_access_token)
          .maybeSingle();
        if (!orderRow) return jsonRes({ error: "Acesso negado ao pedido" }, 403, corsHeaders);
      }

      // ── Read pricing config ──
      const { data: pricingConfig } = await supabase
        .from("payment_pricing_config")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      // ── Server-side price validation ──
      let serverSubtotal = 0;
      let serverSubtotalFull = 0;
      let serverSubtotalSale = 0;
      const priceErrors: string[] = [];
      const couponLineItems: CouponLineItem[] = [];

      // Batch fetch all variants to avoid N+1 query
      const variantIds = (products || [])
        .map((p: any) => p.variant_id)
        .filter((id: any) => id);

      const variantsDataMap: Record<string, any> = {};

      if (variantIds.length > 0) {
        // Chunk requests to avoid hitting URL length limits on large carts
        const chunkSize = 100;
        for (let i = 0; i < variantIds.length; i += chunkSize) {
          const chunk = variantIds.slice(i, i + chunkSize);
          const { data: variantsChunk, error: variantsError } = await supabase
            .from("product_variants")
            .select("id, price_modifier, sale_price, base_price, products!inner(id, category_id, base_price, sale_price, is_active)")
            .in("id", chunk);

          if (!variantsError && variantsChunk) {
            for (let j = 0; j < variantsChunk.length; j++) {
              variantsDataMap[variantsChunk[j].id] = variantsChunk[j];
            }
          }
        }
      }

      for (const product of (products || [])) {
        if (!product.variant_id) continue;

        const variantData = variantsDataMap[product.variant_id];

        if (!variantData) { priceErrors.push(`Variante ${product.variant_id} não encontrada`); continue; }
        const productData = variantData.products as any;
        if (!productData?.is_active) { priceErrors.push(`Produto "${product.name}" indisponível`); continue; }

        let realUnitPrice: number;
        if (variantData.sale_price && Number(variantData.sale_price) > 0) {
          realUnitPrice = Number(variantData.sale_price);
        } else if (variantData.base_price && Number(variantData.base_price) > 0) {
          realUnitPrice = Number(variantData.base_price);
        } else {
          realUnitPrice = Number(productData.sale_price || productData.base_price) + Number(variantData.price_modifier || 0);
        }

        const lineTotal = realUnitPrice * (product.quantity || 1);
        serverSubtotal += lineTotal;
        couponLineItems.push({
          product_id: String(productData.id),
          category_id: (productData.category_id as string | null) ?? null,
          lineTotal,
        });

        const isSale =
          (variantData.sale_price != null && variantData.base_price != null && Number(variantData.sale_price) < Number(variantData.base_price)) ||
          (productData.sale_price != null && productData.base_price != null && Number(productData.sale_price) < Number(productData.base_price));
        if (isSale) serverSubtotalSale += lineTotal;
        else serverSubtotalFull += lineTotal;
      }

      if (priceErrors.length > 0) return jsonRes({ error: priceErrors.join("; ") }, 400, corsHeaders);

      // ── Coupon validation ──
      let validatedDiscount = 0;
      if (coupon_code) {
        const { data: coupon } = await supabase
          .from("coupons")
          .select("*")
          .eq("code", coupon_code.toUpperCase())
          .eq("is_active", true)
          .maybeSingle();
        if (!coupon) return jsonRes({ error: "Cupom inválido ou inativo" }, 400, corsHeaders);

        const { data: orderLocationRow } = await supabase
          .from("orders")
          .select("shipping_state, shipping_zip")
          .eq("id", order_id)
          .maybeSingle();

        const couponCheck = validateAndComputeCouponDiscount(
          coupon as Record<string, unknown>,
          couponLineItems,
          serverSubtotal,
          String(orderLocationRow?.shipping_state || ""),
          String(orderLocationRow?.shipping_zip || ""),
        );
        if (couponCheck.error) return jsonRes({ error: couponCheck.error }, 400, corsHeaders);
        validatedDiscount = couponCheck.discount;

        if (Math.abs(validatedDiscount - Number(discount_amount || 0)) > 0.1) {
          return jsonRes({ error: "Valor do desconto divergente. Recarregue a página." }, 400, corsHeaders);
        }
      }

      // ── Compute server total ──
      const { data: orderRow } = await supabase
        .from("orders")
        .select("shipping_cost, tenant_id, status, transaction_id")
        .eq("id", order_id)
        .maybeSingle();
      const orderShippingCost = Number(orderRow?.shipping_cost ?? 0);
      const tenantIdForMovements = (orderRow?.tenant_id as string | undefined) ?? DEFAULT_TENANT_ID;
      const orderStatus = orderRow?.status as string | undefined;
      let paymentIntentIdToUse = orderRow?.transaction_id as string | undefined;
      let shouldReuseExistingIntentEffective =
        !!paymentIntentIdToUse && (orderStatus === "pending" || orderStatus === "processing");

      // Lock / idempotency for embedded/internal flow:
      // avoid a window where two concurrent "start checkout" requests both debit stock
      // before transaction_id (PaymentIntent id) is persisted in orders.
      if (!shouldReuseExistingIntentEffective) {
        const canTryLock = orderStatus === "pending";
        let lockAcquired = false;

        if (canTryLock) {
          const { data: lockRow, error: lockErr } = await supabase
            .from("orders")
            .update({
              status: "processing",
              notes: "STRIPE_PI_INFLIGHT",
              updated_at: new Date().toISOString(),
            })
            .eq("id", order_id)
            .eq("status", "pending")
            .select("id, status, transaction_id")
            .maybeSingle();

          if (lockErr) {
            return jsonRes({ error: `Falha ao adquirir lock do pedido: ${lockErr.message}` }, 500, corsHeaders);
          }

          lockAcquired = !!lockRow;
          paymentIntentIdToUse = lockRow?.transaction_id as string | undefined;
          shouldReuseExistingIntentEffective =
            !!paymentIntentIdToUse && (lockRow?.status === "pending" || lockRow?.status === "processing");
        }

        if (!shouldReuseExistingIntentEffective) {
          // Someone else may already be creating the PI: wait briefly for transaction_id to appear.
          for (let attempt = 0; attempt < 6; attempt++) {
            const { data: latest } = await supabase
              .from("orders")
              .select("status, transaction_id")
              .eq("id", order_id)
              .maybeSingle();

            if (latest?.transaction_id) {
              paymentIntentIdToUse = latest.transaction_id as string;
              shouldReuseExistingIntentEffective = true;
              break;
            }

            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 200));
          }

          if (!shouldReuseExistingIntentEffective) {
            return jsonRes(
              { error: "Checkout em processamento. Tente novamente em instantes." },
              409,
              corsHeaders
            );
          }
        }
      }

      const serverBaseTotal = serverSubtotal - validatedDiscount + orderShippingCost;
      let serverTotal: number;
      const isPixMethod = payment_method === "pix";

      if (isPixMethod) {
        const pixDiscountPct = Number(pricingConfig?.pix_discount || 0) / 100;
        const applyPixToSale = pricingConfig?.pix_discount_applies_to_sale_products !== false;
        if (!applyPixToSale && serverSubtotal > 0) {
          const afterCoupon = serverSubtotal - validatedDiscount;
          const ratioFull = serverSubtotalFull / serverSubtotal;
          const ratioSale = serverSubtotalSale / serverSubtotal;
          serverTotal = afterCoupon * ratioFull * (1 - pixDiscountPct) + afterCoupon * ratioSale + orderShippingCost;
        } else {
          serverTotal = (serverSubtotal - validatedDiscount) * (1 - pixDiscountPct) + orderShippingCost;
        }
      } else {
        // Cartão: aplicar juros quando parcelas > sem juros
        const effectiveInterestFree =
          serverSubtotalSale > 0 && pricingConfig?.interest_free_installments_sale != null
            ? Number(pricingConfig.interest_free_installments_sale)
            : Number(pricingConfig?.interest_free_installments || 3);
        const n = Math.max(1, Number(installments) || 1);

        if (n > effectiveInterestFree) {
          const monthlyRatePct =
            pricingConfig?.interest_mode === "by_installment"
              ? Number((pricingConfig?.monthly_rate_by_installment || {})[String(n)] ?? pricingConfig?.monthly_rate_fixed ?? 0)
              : Number(pricingConfig?.monthly_rate_fixed || 0);
          const monthlyRate = monthlyRatePct / 100;
          const i = monthlyRate;
          const rawInstallment = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1) * serverBaseTotal;
          const totalExact = rawInstallment * n;
          serverTotal = Math.round(totalExact * 100) / 100;
        } else {
          serverTotal = serverBaseTotal;
        }
      }

      // Tolerance check
      const tolerance = Math.max(0.10, serverTotal * 0.01);
      if (Math.abs(serverTotal - amount) > tolerance) {
        await supabase.from("error_logs").insert({
          error_type: "price_divergence",
          error_message: "Valor do pedido divergente (create_payment_intent)",
          error_context: { order_id, client_amount: amount, server_total: serverTotal },
          severity: "warning",
        });
        return jsonRes({ error: "Valor do pedido divergente. Recarregue a página." }, 400, corsHeaders);
      }

      const authorizedAmount = serverTotal;

      // ── Stock validation ──
      const stockDecrements: { variant_id: string; quantity: number }[] = [];
      if (!shouldReuseExistingIntentEffective) {
        for (const product of (products || [])) {
          if (!product.variant_id) continue;
          const qty = product.quantity || 1;
          const { data: result, error: rpcError } = await supabase.rpc("decrement_stock", {
            p_variant_id: product.variant_id,
            p_quantity: qty,
          });
          if (rpcError) {
            for (const dec of stockDecrements) {
              await supabase.rpc("increment_stock", { p_variant_id: dec.variant_id, p_quantity: dec.quantity });
              await supabase.from("inventory_movements").insert({
                tenant_id: tenantIdForMovements,
                variant_id: dec.variant_id,
                order_id: order_id,
                type: "refund",
                quantity: dec.quantity,
              });
            }
            return jsonRes({ error: `Erro de estoque: ${rpcError.message}` }, 400, corsHeaders);
          }

          const stockResult = typeof result === "string" ? JSON.parse(result) : result;
          if (!stockResult?.success) {
            for (const dec of stockDecrements) {
              await supabase.rpc("increment_stock", { p_variant_id: dec.variant_id, p_quantity: dec.quantity });
              await supabase.from("inventory_movements").insert({
                tenant_id: tenantIdForMovements,
                variant_id: dec.variant_id,
                order_id: order_id,
                type: "refund",
                quantity: dec.quantity,
              });
            }
            return jsonRes({ error: stockResult?.message || "Estoque insuficiente" }, 400, corsHeaders);
          }

          stockDecrements.push({ variant_id: product.variant_id, quantity: qty });
          try {
            // Audit trail: hold/reservation for this order until PI succeeds/confirmed.
            await supabase.from("inventory_movements").insert({
              tenant_id: tenantIdForMovements,
              variant_id: product.variant_id,
              order_id: order_id,
              type: "reserve",
              quantity: qty,
            });
          } catch (e) {
            // If we already debited stock but couldn't write the reservation record, we must rollback.
            for (const dec of stockDecrements) {
              await supabase.rpc("increment_stock", { p_variant_id: dec.variant_id, p_quantity: dec.quantity });
              await supabase.from("inventory_movements").insert({
                tenant_id: tenantIdForMovements,
                variant_id: dec.variant_id,
                order_id: order_id,
                type: "refund",
                quantity: dec.quantity,
              });
            }
            return jsonRes({ error: "Falha ao registrar reserva de estoque" }, 500, corsHeaders);
          }
        }
      }

      // ── Create or find Stripe customer ──
      let stripeCustomerId: string | undefined;
      if (customer_email) {
        const customers = await stripe.customers.list({ email: customer_email, limit: 1 });
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id;
        } else {
          const newCustomer = await stripe.customers.create({
            email: customer_email,
            name: customer_name || undefined,
          });
          stripeCustomerId = newCustomer.id;
        }
      }

      // ── Determine payment method types ──
      // Only use "pix" if the method was requested; card is always safe
      const paymentMethodTypes: string[] = isPixMethod ? ["pix"] : ["card"];

      // Amount in centavos (BRL)
      const amountInCents = Math.round(authorizedAmount * 100);

      // ── Create PaymentIntent ──
      const intentParams: Stripe.PaymentIntentCreateParams = {
        amount: amountInCents,
        currency: "brl",
        payment_method_types: paymentMethodTypes,
        metadata: {
          order_id,
          coupon_code: coupon_code || "",
          discount_amount: String(validatedDiscount),
          installments: String(installments),
        },
      };

      if (stripeCustomerId) {
        intentParams.customer = stripeCustomerId;
      }

      // ── Store name for statement descriptor ──
      const { data: storeSettings } = await supabase
        .from("store_settings")
        .select("store_name")
        .limit(1)
        .maybeSingle();
      const storeName = storeSettings?.store_name || "LOJA";
      const descriptor = storeName.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 22).trim() || "LOJA";
      intentParams.statement_descriptor = descriptor.slice(0, 22);

      let paymentIntent: Stripe.PaymentIntent;
      if (shouldReuseExistingIntentEffective && paymentIntentIdToUse) {
        // Embedded/internal retry: never debit estoque novamente.
        paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentIdToUse);
      } else {
        try {
          paymentIntent = await stripe.paymentIntents.create(intentParams, {
            idempotencyKey: `pi_${order_id}`,
          });
        } catch (stripeErr: any) {
        // PaymentIntent could not be created. Since we already decremented stock above,
        // we must rollback immediately to avoid leaving inventory "stuck" until TTL.
          for (const dec of stockDecrements) {
            await supabase.rpc("increment_stock", { p_variant_id: dec.variant_id, p_quantity: dec.quantity });
            await supabase.from("inventory_movements").insert({
              tenant_id: tenantIdForMovements,
              variant_id: dec.variant_id,
              order_id: order_id,
              type: "refund",
              quantity: dec.quantity,
            });
          }

          const msg = stripeErr?.message || "Erro ao criar PaymentIntent";

          // Mark order as failed so release-expired-reservations won't double-restore it.
          await supabase.from("orders").update({
            status: "failed",
            notes: `STRIPE PI CREATE FAILED: ${msg}`,
            last_webhook_event: "payment_intent.create_failed",
            updated_at: new Date().toISOString(),
          }).eq("id", order_id);

          // If PIX is not enabled in the Stripe account, return a clear message.
          if (isPixMethod && msg.toLowerCase().includes("pix")) {
            return jsonRes(
              { error: "O método PIX não está ativado na sua conta Stripe. Use cartão de crédito ou ative o PIX no painel Stripe." },
              400,
              corsHeaders
            );
          }

          return jsonRes({ error: msg }, 500, corsHeaders);
        }
      }

      // ── Update order with Stripe info ──
      await supabase.from("orders").update({
        provider: "stripe",
        gateway: "stripe",
        transaction_id: paymentIntent.id,
        payment_method: isPixMethod ? "pix" : "card",
        installments: isPixMethod ? null : installments,
        total_amount: authorizedAmount,
      }).eq("id", order_id);

      console.log(JSON.stringify({ scope: "stripe-create-intent", request_id: requestId, provider: "stripe", order_id, payment_intent_id: paymentIntent.id, action: "create_payment_intent" }));

      const res: Record<string, unknown> = {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        amount: authorizedAmount,
      };

      // PIX: return QR and copy-paste for display on checkout (no redirect)
      if (isPixMethod) {
        let pixAction = paymentIntent.next_action?.type === "pix_display_qr_code"
          ? (paymentIntent.next_action.pix_display_qr_code as { image_url_png?: string; image_url_svg?: string; expires_at?: number; data?: string } | undefined)
          : undefined;
        if (!pixAction) {
          const retrieved = await stripe.paymentIntents.retrieve(paymentIntent.id);
          if (retrieved.next_action?.type === "pix_display_qr_code") {
            pixAction = retrieved.next_action.pix_display_qr_code as { image_url_png?: string; image_url_svg?: string; expires_at?: number; data?: string };
          }
        }
        if (pixAction) {
          res.pix_qr_url = pixAction.image_url_png ?? pixAction.image_url_svg ?? null;
          res.pix_emv = pixAction.data ?? null;
          res.pix_expires_at = pixAction.expires_at ?? null;
        }
      }

      return jsonRes(res, 200, corsHeaders);
    }

    // ─── Action: create_checkout_session (external Stripe Checkout) ───
    if (action === "create_checkout_session") {
      const { order_id, amount, customer_email, customer_name, products, success_url, cancel_url, order_access_token, coupon_code, discount_amount = 0 } = body;

      if (!order_id || !amount || !success_url) {
        return jsonRes({ error: "order_id, amount e success_url são obrigatórios" }, 400, corsHeaders);
      }

      // ── Auth check ──
      const authHeader = req.headers.get("Authorization");
      const hasBearer = !!authHeader?.startsWith("Bearer ");
      if (!hasBearer) {
        if (!order_access_token) return jsonRes({ error: "Autenticação necessária" }, 401, corsHeaders);
        const { data: orderRow } = await supabase
          .from("orders")
          .select("id")
          .eq("id", order_id)
          .eq("access_token", order_access_token)
          .maybeSingle();
        if (!orderRow) return jsonRes({ error: "Acesso negado ao pedido" }, 403, corsHeaders);
      }

      // ── Server-side price validation ──
      const lineItems: any[] = [];
      let serverSubtotal = 0;
      const couponLineItems: CouponLineItem[] = [];

      // Batch fetch all variants to avoid N+1 query
      const checkoutVariantIds = (products || [])
        .map((p: any) => p.variant_id)
        .filter((id: any) => id);

      const checkoutVariantsDataMap: Record<string, any> = {};

      if (checkoutVariantIds.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < checkoutVariantIds.length; i += chunkSize) {
          const chunk = checkoutVariantIds.slice(i, i + chunkSize);
          const { data: variantsChunk, error: variantsError } = await supabase
            .from("product_variants")
            .select("id, price_modifier, sale_price, base_price, products!inner(id, category_id, base_price, sale_price, is_active, name)")
            .in("id", chunk);

          if (!variantsError && variantsChunk) {
            for (let j = 0; j < variantsChunk.length; j++) {
              checkoutVariantsDataMap[variantsChunk[j].id] = variantsChunk[j];
            }
          }
        }
      }

      for (const product of (products || [])) {
        if (!product.variant_id) continue;

        const variantData = checkoutVariantsDataMap[product.variant_id];

        if (!variantData) return jsonRes({ error: `Variante ${product.variant_id} não encontrada` }, 400, corsHeaders);
        const productData = variantData.products as any;
        if (!productData?.is_active) return jsonRes({ error: `Produto "${productData?.name || product.name}" indisponível` }, 400, corsHeaders);

        let realUnitPrice: number;
        if (variantData.sale_price && Number(variantData.sale_price) > 0) {
          realUnitPrice = Number(variantData.sale_price);
        } else if (variantData.base_price && Number(variantData.base_price) > 0) {
          realUnitPrice = Number(variantData.base_price);
        } else {
          realUnitPrice = Number(productData.sale_price || productData.base_price) + Number(variantData.price_modifier || 0);
        }

        serverSubtotal += realUnitPrice * (product.quantity || 1);
        couponLineItems.push({
          product_id: String(productData.id),
          category_id: (productData.category_id as string | null) ?? null,
          lineTotal: realUnitPrice * (product.quantity || 1),
        });

        lineItems.push({
          price_data: {
            currency: "brl",
            product_data: { name: product.name },
            unit_amount: Math.round(realUnitPrice * 100),
          },
          quantity: product.quantity || 1,
        });
      }

      // ── Shipping as line item ──
      const { data: orderRow } = await supabase.from("orders").select("shipping_cost").eq("id", order_id).maybeSingle();
      const shippingCost = Number(orderRow?.shipping_cost ?? 0);
      if (shippingCost > 0) {
        lineItems.push({
          price_data: {
            currency: "brl",
            product_data: { name: "Frete" },
            unit_amount: Math.round(shippingCost * 100),
          },
          quantity: 1,
        });
      }

      if (lineItems.length === 0) {
        return jsonRes({ error: "Nenhum item válido para checkout" }, 400, corsHeaders);
      }

      // ── Coupon / discount ──
      let validatedDiscount = 0;
      if (coupon_code) {
        const { data: coupon } = await supabase
          .from("coupons")
          .select("*")
          .eq("code", coupon_code.toUpperCase())
          .eq("is_active", true)
          .maybeSingle();
        if (!coupon) return jsonRes({ error: "Cupom inválido ou inativo" }, 400, corsHeaders);
        const { data: orderLocationRow } = await supabase
          .from("orders")
          .select("shipping_state, shipping_zip")
          .eq("id", order_id)
          .maybeSingle();
        const couponCheck = validateAndComputeCouponDiscount(
          coupon as Record<string, unknown>,
          couponLineItems,
          serverSubtotal,
          String(orderLocationRow?.shipping_state || ""),
          String(orderLocationRow?.shipping_zip || ""),
        );
        if (couponCheck.error) return jsonRes({ error: couponCheck.error }, 400, corsHeaders);
        validatedDiscount = couponCheck.discount;
        if (Math.abs(validatedDiscount - Number(discount_amount || 0)) > 0.1) {
          return jsonRes({ error: "Valor do desconto divergente. Recarregue a página." }, 400, corsHeaders);
        }
      }

      // ── Build Stripe Checkout session ──
      const sessionParams: any = {
        mode: "payment",
        customer_email: customer_email || undefined,
        line_items: lineItems,
        success_url,
        cancel_url: cancel_url || success_url,
        metadata: { order_id, order_access_token: order_access_token || "" },
        payment_intent_data: {
          metadata: { order_id, order_access_token: order_access_token || "" },
        },
        payment_method_types: ["card"],
        locale: "pt-BR",
        shipping_address_collection: {
          allowed_countries: ["BR"],
        },
        phone_number_collection: {
          enabled: true,
        },
      };

      // Apply discount as Stripe coupon
      if (validatedDiscount > 0) {
        const stripeCoupon = await stripe.coupons.create({
          amount_off: Math.round(validatedDiscount * 100),
          currency: "brl",
          duration: "once",
          name: coupon_code || "Desconto",
        });
        sessionParams.discounts = [{ coupon: stripeCoupon.id }];
      }

      let session;
      try {
        session = await stripe.checkout.sessions.create(sessionParams, {
          idempotencyKey: `cs_${order_id}`,
        });
      } catch (stripeErr: any) {
        const msg = stripeErr?.message || "Erro ao criar sessão de checkout";
        const code = stripeErr?.code || stripeErr?.type;
        console.error("Stripe checkout.sessions.create failed:", msg, code ? `(${code})` : "");
        return jsonRes({ error: msg }, 500, corsHeaders);
      }

      const updatePayload: Record<string, unknown> = {
        provider: "stripe",
        gateway: "stripe",
        external_reference: session.id,
        payment_method: "card",
        total_amount: serverSubtotal - validatedDiscount + shippingCost,
      };
      if (session.payment_intent) {
        updatePayload.transaction_id = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent as any)?.id;
      }

      await supabase.from("orders").update(updatePayload).eq("id", order_id);

      console.log(JSON.stringify({ scope: "stripe-create-intent", request_id: requestId, provider: "stripe", order_id, session_id: session.id, action: "create_checkout_session" }));

      return jsonRes({ checkout_url: session.url, session_id: session.id }, 200, corsHeaders);
    }

    return jsonRes({ error: "Ação inválida" }, 400, corsHeaders);
  } catch (error: any) {
    const msg = error?.message || String(error);
    const code = error?.code ?? error?.type;
    console.error("Stripe error:", msg, code ? `(${code})` : "");
    return jsonRes({ error: msg || "Erro ao processar pagamento Stripe" }, 500, corsHeaders);
  }
});
