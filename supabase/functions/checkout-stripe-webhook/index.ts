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

  const secretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

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

  if (!['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    return successResponse({ received: true, skipped: true }, corsHeaders);
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

  try {
    switch (event.type) {
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
