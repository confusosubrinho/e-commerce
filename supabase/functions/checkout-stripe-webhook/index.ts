import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";
import { logError, logInfo } from "../_shared/log.ts";

const SCOPE = "checkout-stripe-webhook";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = {
    ...getCorsHeaders(origin),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, stripe-signature",
  };
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: stripeProvider } = await supabase
    .from("integrations_checkout_providers")
    .select("config")
    .eq("provider", "stripe")
    .maybeSingle();
  const stripeConfig = (stripeProvider?.config || {}) as Record<string, unknown>;
  const secretKey = (stripeConfig.secret_key as string)?.trim() || Deno.env.get("STRIPE_SECRET_KEY") || "";

  const stripe = new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
  });

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    logError(SCOPE, correlationId, new Error("Missing stripe-signature header or STRIPE_WEBHOOK_SECRET"));
    return errorResponse("Missing signature or webhook secret", 400, corsHeaders);
  }

  // Read raw body BEFORE any JSON parsing — required for signature validation
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(SCOPE, correlationId, err, { event_type: "signature_verification" });
    return errorResponse("Invalid signature", 400, corsHeaders);
  }

  logInfo(SCOPE, correlationId, `Event received: ${event.type}`, { event_id: event.id, event_type: event.type });

  // ── IDEMPOTENCY CHECK ─────────────────────────────────────────────
  const { error: idempError } = await supabase
    .from("stripe_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
      payload: event.data.object as Record<string, unknown>,
      processed: true,
    });

  if (idempError) {
    if (idempError.code === "23505") {
      logInfo(SCOPE, correlationId, "Duplicate event — skipping", { event_id: event.id });
      return successResponse({ received: true, duplicate: true }, corsHeaders);
    }
    logError(SCOPE, correlationId, idempError, { event_id: event.id });
  }

  // ── HELPERS ────────────────────────────────────────────────────────

  /** Map Stripe subscription status to tenant billing_status */
  function mapStripeSubscriptionStatus(status: string): "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete" {
    switch (status) {
      case "active":
        return "active";
      case "trialing":
        return "trialing";
      case "past_due":
        return "past_due";
      case "canceled":
      case "unpaid":
      case "incomplete_expired":
        return "canceled";
      case "incomplete":
        return "incomplete";
      default:
        return "active";
    }
  }

  /** Update order by transaction_id (payment_intent id) */
  async function updateOrderByPI(piId: string, data: Record<string, unknown>) {
    const { error } = await supabase
      .from("orders")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("transaction_id", piId);
    if (error) console.error(`Failed to update order (PI ${piId}):`, error.message);
    return error;
  }

  /** Update order by stripe_charge_id */
  async function updateOrderByCharge(chargeId: string, data: Record<string, unknown>) {
    const { error } = await supabase
      .from("orders")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("stripe_charge_id", chargeId);
    if (error) console.error(`Failed to update order (charge ${chargeId}):`, error.message);
    return error;
  }

  /** Restore stock for an order with audit trail (mt-backend: usa tenant_id do pedido). */
  async function restoreStock(orderId: string) {
    const { data: orderRow } = await supabase
      .from("orders")
      .select("tenant_id")
      .eq("id", orderId)
      .maybeSingle();
    const tenantId = (orderRow?.tenant_id as string) ?? "00000000-0000-0000-0000-000000000001";

    const { data: items } = await supabase
      .from("order_items")
      .select("product_variant_id, quantity")
      .eq("order_id", orderId);

    for (const item of items || []) {
      if (item.product_variant_id) {
        // Check if already released/refunded to avoid double restore
        const { data: alreadyReleased } = await supabase
          .from("inventory_movements")
          .select("id")
          .eq("order_id", orderId)
          .eq("variant_id", item.product_variant_id)
          .in("type", ["release", "refund"])
          .maybeSingle();

        if (!alreadyReleased) {
          await supabase.rpc("increment_stock", {
            p_variant_id: item.product_variant_id,
            p_quantity: item.quantity,
          });
          await supabase.from("inventory_movements").insert({
            tenant_id: tenantId,
            variant_id: item.product_variant_id,
            order_id: orderId,
            type: "refund",
            quantity: item.quantity,
          });
        }
      }
    }
  }

  /** Find order id by transaction_id (payment intent) */
  async function findOrderIdByPI(piId: string): Promise<string | null> {
    const { data } = await supabase
      .from("orders")
      .select("id")
      .eq("transaction_id", piId)
      .maybeSingle();
    return data?.id ?? null;
  }

  // ── EVENT HANDLERS ─────────────────────────────────────────────────
  try {
    switch (event.type) {
      // ─── payment_intent.succeeded ──────────────────────────────
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.order_id;
        const piId = pi.id;

        console.log(JSON.stringify({ scope: "stripe-webhook", provider: "stripe", event_id: event.id, event_type: event.type, order_id: orderId ?? null, payment_intent_id: piId }));

        if (orderId) {
          // Update existing order
          await supabase.from("orders").update({
            status: "paid",
            transaction_id: piId,
            last_webhook_event: "payment_intent.succeeded",
            payment_method: pi.payment_method_types?.[0] || "card",
            provider: "stripe",
            gateway: "stripe",
            updated_at: new Date().toISOString(),
          }).eq("id", orderId);

          // Store charge id if available
          const latestCharge = pi.latest_charge;
          if (latestCharge && typeof latestCharge === "string") {
            await supabase.from("orders").update({ stripe_charge_id: latestCharge }).eq("id", orderId);
          }

          // Insert payment record (idempotent: skip if already exists for this PI)
          const { data: existingPayment } = await supabase
            .from("payments")
            .select("id")
            .eq("provider", "stripe")
            .eq("transaction_id", piId)
            .maybeSingle();

          if (!existingPayment) {
            await supabase.from("payments").insert({
              order_id: orderId,
              provider: "stripe",
              gateway: "stripe",
              amount: pi.amount / 100,
              status: "approved",
              payment_method: pi.payment_method_types?.[0] || "card",
              transaction_id: piId,
              installments: Number(pi.metadata?.installments) || 1,
              raw: pi as unknown as Record<string, unknown>,
            });
          }

          // Update customer stats
          const { data: order } = await supabase
            .from("orders")
            .select("customer_email, total_amount, shipping_name")
            .eq("id", orderId)
            .maybeSingle();

          if (order?.customer_email) {
            const email = order.customer_email.toLowerCase();
            const { data: existing } = await supabase
              .from("customers")
              .select("id, total_orders, total_spent")
              .eq("email", email)
              .maybeSingle();

            if (existing) {
              await supabase.from("customers").update({
                total_orders: (existing.total_orders || 0) + 1,
                total_spent: (existing.total_spent || 0) + (order.total_amount || 0),
              }).eq("id", existing.id);
              await supabase.from("orders").update({ customer_id: existing.id }).eq("id", orderId);
            } else {
              const { data: newC } = await supabase.from("customers").insert({
                email,
                full_name: order.shipping_name || "Cliente",
                total_orders: 1,
                total_spent: order.total_amount || 0,
              }).select("id").single();
              if (newC) {
                await supabase.from("orders").update({ customer_id: newC.id }).eq("id", orderId);
              }
            }
          }

          // Increment coupon uses
          const couponCode = pi.metadata?.coupon_code;
          if (couponCode) {
            const { data: coupon } = await supabase
              .from("coupons")
              .select("id")
              .eq("code", couponCode.toUpperCase())
              .maybeSingle();
            if (coupon) {
              await supabase.rpc("increment_coupon_uses", { p_coupon_id: coupon.id });
            }
          }
        } else {
          // No order_id in metadata — try to find by transaction_id
          const existingOrderId = await findOrderIdByPI(piId);
          if (existingOrderId) {
            await updateOrderByPI(piId, {
              status: "paid",
              last_webhook_event: "payment_intent.succeeded",
            });
          } else {
            console.warn(`⚠️ payment_intent.succeeded: No order found for PI ${piId}`);
          }
        }
        break;
      }

      // ─── payment_intent.payment_failed ─────────────────────────
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.order_id;
        const piId = pi.id;
        const lastError = pi.last_payment_error?.message || "Pagamento falhou";

        console.log(`❌ payment_intent.payment_failed: ${piId}, reason: ${lastError}`);

        const targetOrderId = orderId || (await findOrderIdByPI(piId));

        if (targetOrderId) {
          await supabase.from("orders").update({
            status: "failed",
            notes: `STRIPE FALHOU: ${lastError}`,
            last_webhook_event: "payment_intent.payment_failed",
            updated_at: new Date().toISOString(),
          }).eq("id", targetOrderId);

          await restoreStock(targetOrderId);
        } else {
          console.warn(`⚠️ payment_intent.payment_failed: No order found for PI ${piId}`);
        }
        break;
      }

      // ─── payment_intent.canceled ───────────────────────────────
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const piId = pi.id;

        console.log(`🚫 payment_intent.canceled: ${piId}`);

        const targetOrderId = pi.metadata?.order_id || (await findOrderIdByPI(piId));

        if (targetOrderId) {
          await supabase.from("orders").update({
            status: "cancelled",
            notes: "Cancelado via Stripe",
            last_webhook_event: "payment_intent.canceled",
            updated_at: new Date().toISOString(),
          }).eq("id", targetOrderId);

          await restoreStock(targetOrderId);
        }
        break;
      }

      // ─── charge.refunded ───────────────────────────────────────
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const chargeId = charge.id;
        const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;

        console.log(`🔄 charge.refunded: ${chargeId}, PI: ${piId || "N/A"}`);

        // Try updating by stripe_charge_id first, then by transaction_id (PI)
        let err = await updateOrderByCharge(chargeId, {
          status: "refunded",
          last_webhook_event: "charge.refunded",
        });

        if (err && piId) {
          err = await updateOrderByPI(piId, {
            status: "refunded",
            last_webhook_event: "charge.refunded",
          });
        }

        // Update payment record too
        if (piId) {
          await supabase.from("payments").update({
            status: "refunded",
          }).eq("transaction_id", piId);
        }
        break;
      }

      // ─── charge.dispute.created ────────────────────────────────
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : (dispute.charge as Stripe.Charge)?.id;
        const piId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : null;

        console.log(`⚠️ charge.dispute.created: charge=${chargeId}, PI=${piId || "N/A"}`);

        if (chargeId) {
          let err = await updateOrderByCharge(chargeId, {
            status: "disputed",
            notes: `Disputa aberta: ${dispute.reason || "unknown"}`,
            last_webhook_event: "charge.dispute.created",
          });
          if (err && piId) {
            await updateOrderByPI(piId, {
              status: "disputed",
              notes: `Disputa aberta: ${dispute.reason || "unknown"}`,
              last_webhook_event: "charge.dispute.created",
            });
          }
        }
        break;
      }

      // ─── charge.dispute.closed ─────────────────────────────────
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : (dispute.charge as Stripe.Charge)?.id;
        const piId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : null;
        const won = dispute.status === "won";

        console.log(`🏁 charge.dispute.closed: status=${dispute.status}, won=${won}`);

        const newStatus = won ? "paid" : "disputed";
        const note = won
          ? "Disputa encerrada: ganhou — fundos restituídos"
          : `Disputa encerrada: ${dispute.status}`;

        if (chargeId) {
          let err = await updateOrderByCharge(chargeId, {
            status: newStatus,
            notes: note,
            last_webhook_event: "charge.dispute.closed",
          });
          if (err && piId) {
            await updateOrderByPI(piId, {
              status: newStatus,
              notes: note,
              last_webhook_event: "charge.dispute.closed",
            });
          }
        }
        break;
      }

      // ─── checkout.session.completed ────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const orderId = session.metadata?.order_id;
        const piId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent as any)?.id ?? null;

        console.log(`🛒 checkout.session.completed: session=${session.id}, order_id=${orderId || "N/A"}, payment_status=${session.payment_status}`);

        if (orderId) {
          // Check if already paid by payment_intent.succeeded (avoid overwriting)
          const { data: currentOrder } = await supabase
            .from("orders")
            .select("status")
            .eq("id", orderId)
            .maybeSingle();

          const updateData: Record<string, unknown> = {
            customer_email: session.customer_details?.email || null,
            last_webhook_event: "checkout.session.completed",
            external_reference: session.id,
          };

          // Only update status if not already paid (payment_intent.succeeded may have fired first)
          if (session.payment_status === "paid" && currentOrder?.status !== "paid") {
            updateData.status = "paid";
            updateData.transaction_id = piId || updateData.transaction_id;
            updateData.payment_method = session.payment_method_types?.[0] || "card";
            updateData.provider = "stripe";
            updateData.gateway = "stripe";
          }

          // Update shipping info from Stripe-collected address
          const shipping = session.shipping_details || session.customer_details;
          if (shipping?.address) {
            const addr = shipping.address;
            updateData.shipping_name = shipping.name || session.customer_details?.name || "Cliente";
            updateData.shipping_address = [addr.line1, addr.line2].filter(Boolean).join(", ") || "N/A";
            updateData.shipping_city = addr.city || "N/A";
            updateData.shipping_state = addr.state || "XX";
            updateData.shipping_zip = (addr.postal_code || "").replace(/\D/g, "") || "00000000";
          } else if (session.customer_details?.name) {
            updateData.shipping_name = session.customer_details.name;
          }

          if (session.customer_details?.phone) {
            updateData.shipping_phone = session.customer_details.phone;
          }

          if (piId && !updateData.transaction_id) {
            updateData.transaction_id = piId;
          }

          await supabase.from("orders").update({
            ...updateData,
            updated_at: new Date().toISOString(),
          }).eq("id", orderId);

          // Idempotent payment record when paid (same as payment_intent.succeeded; avoids duplicate if both events are processed)
          if (session.payment_status === "paid" && (piId || session.id)) {
            const txnId = piId || session.id;
            const { data: existingPayment } = await supabase
              .from("payments")
              .select("id")
              .eq("provider", "stripe")
              .eq("transaction_id", txnId)
              .maybeSingle();

            if (!existingPayment) {
              const amountCents = Number(session.amount_total) || 0;
              await supabase.from("payments").insert({
                order_id: orderId,
                provider: "stripe",
                gateway: "stripe",
                amount: amountCents / 100,
                status: "approved",
                payment_method: session.payment_method_types?.[0] || "card",
                transaction_id: txnId,
                installments: 1,
                raw: session as unknown as Record<string, unknown>,
              });
            }
          }
        }
        break;
      }

      // ─── Billing dos lojistas (SaaS): customer.subscription.* ───
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const tenantId = (sub.metadata?.tenant_id as string) || null;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        const status = sub.status;

        logInfo(SCOPE, correlationId, `Subscription ${event.type}`, {
          subscription_id: sub.id,
          customer_id: customerId,
          tenant_id: tenantId,
          status,
        });

        const billingStatus = mapStripeSubscriptionStatus(status);
        const planExpiresAt = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        let targetTenantId = tenantId;
        if (!targetTenantId && customerId) {
          const { data: t } = await supabase
            .from("tenants")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          targetTenantId = t?.id ?? null;
        }

        if (targetTenantId) {
          const priceId = sub.items?.data?.[0]?.price?.id ?? null;
          let planId: string | null = null;
          if (priceId) {
            const { data: plans } = await supabase
              .from("tenant_plans")
              .select("id")
              .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
              .limit(1);
            planId = plans?.[0]?.id ?? null;
          }

          await supabase
            .from("tenants")
            .update({
              stripe_customer_id: customerId || undefined,
              stripe_subscription_id: sub.id,
              plan_id: planId,
              billing_status: billingStatus,
              plan_expires_at: planExpiresAt,
              trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            })
            .eq("id", targetTenantId);
        } else {
          logError(SCOPE, correlationId, new Error("No tenant_id in metadata and no tenant found by stripe_customer_id"), {
            subscription_id: sub.id,
            customer_id: customerId,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const tenantId = (sub.metadata?.tenant_id as string) || null;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

        logInfo(SCOPE, correlationId, "Subscription deleted", {
          subscription_id: sub.id,
          customer_id: customerId,
          tenant_id: tenantId,
        });

        let targetTenantId = tenantId;
        if (!targetTenantId && customerId) {
          const { data: t } = await supabase
            .from("tenants")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          targetTenantId = t?.id ?? null;
        }

        if (targetTenantId) {
          const { data: freePlan } = await supabase
            .from("tenant_plans")
            .select("id")
            .eq("slug", "free")
            .maybeSingle();

          await supabase
            .from("tenants")
            .update({
              stripe_subscription_id: null,
              plan_id: freePlan?.id ?? null,
              billing_status: "canceled",
              plan_expires_at: null,
            })
            .eq("id", targetTenantId);
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
        break;
    }

    // ── Auto-push order to Bling after successful payment ──
    if (
      event.type === "payment_intent.succeeded" ||
      (event.type === "checkout.session.completed" && (event.data.object as any)?.payment_status === "paid")
    ) {
      const resolvedOrderId =
        (event.data.object as any)?.metadata?.order_id ||
        (event.type === "payment_intent.succeeded"
          ? await findOrderIdByPI((event.data.object as any).id)
          : null);

      if (resolvedOrderId) {
        try {
          const { autoPushOrderToBling } = await import("../_shared/blingStockPush.ts");
          const blingResult = await autoPushOrderToBling(supabase, resolvedOrderId);
          console.log(`[stripe-webhook] Bling auto-push for order ${resolvedOrderId}:`, JSON.stringify(blingResult));
        } catch (blingErr: any) {
          console.warn(`[stripe-webhook] Bling auto-push failed (non-blocking): ${blingErr.message}`);
        }
      }
    }

    await supabase
      .from("stripe_webhook_events")
      .update({ processed_at: new Date().toISOString(), error_message: null })
      .eq("event_id", event.id);

    return successResponse({ received: true }, corsHeaders);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError(SCOPE, correlationId, error, { event_type: event.type, event_id: event.id });
    await supabase
      .from("stripe_webhook_events")
      .update({ processed_at: new Date().toISOString(), error_message: msg })
      .eq("event_id", event.id);
    return successResponse({ received: true, error: msg }, corsHeaders);
  }
});
