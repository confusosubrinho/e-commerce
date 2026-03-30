import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { validateCouponAgainstContext, type CouponLineItem } from "../_shared/coupon-engine.ts";

function jsonRes(body: Record<string, unknown>, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = await req.json();
    const couponCode = String(payload.coupon_code || "").trim().toUpperCase();
    if (!couponCode) return jsonRes({ error: "coupon_code obrigatório" }, 400, corsHeaders);

    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", couponCode)
      .maybeSingle();

    const items = (Array.isArray(payload.items) ? payload.items : []) as Array<Record<string, unknown>>;
    const lineItems: CouponLineItem[] = items.map((item) => ({
      product_id: String(item.product_id || ""),
      category_id: item.category_id ? String(item.category_id) : null,
      brand: item.brand ? String(item.brand) : null,
      line_total: Number(item.line_total || 0),
      is_promotional: item.is_promotional === true,
    }));

    const result = validateCouponAgainstContext(coupon as Record<string, unknown> | null, {
      subtotal: Number(payload.subtotal || 0),
      shipping_cost: Number(payload.shipping_cost || 0),
      shipping_country: payload.shipping_country ? String(payload.shipping_country) : null,
      shipping_state: payload.shipping_state ? String(payload.shipping_state) : null,
      shipping_city: payload.shipping_city ? String(payload.shipping_city) : null,
      shipping_zip: payload.shipping_zip ? String(payload.shipping_zip) : null,
      customer_id: payload.customer_id ? String(payload.customer_id) : null,
      customer_email: payload.customer_email ? String(payload.customer_email) : null,
      customer_is_new: payload.customer_is_new === true,
      line_items: lineItems,
      has_automatic_discount: payload.has_automatic_discount === true,
    });

    if (!result.ok) {
      return jsonRes({
        valid: false,
        error_code: result.error_code,
        error_message: result.error_message,
      }, 200, corsHeaders);
    }

    return jsonRes({
      valid: true,
      discount_amount: result.discount_amount,
      free_shipping: result.free_shipping,
      applicable_subtotal: result.applicable_subtotal,
      applied_rules: result.applied_rules,
      coupon: {
        id: coupon?.id,
        code: coupon?.code,
        discount_type: coupon?.discount_type,
        discount_value: coupon?.discount_value,
        type: coupon?.type,
      },
    }, 200, corsHeaders);
  } catch (error) {
    console.error("[checkout-validate-coupon]", error);
    return jsonRes({ error: "Erro interno ao validar cupom" }, 500, getCorsHeaders(req.headers.get("Origin")));
  }
});
