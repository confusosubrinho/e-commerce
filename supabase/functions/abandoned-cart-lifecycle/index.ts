import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { appendRecoveryEvent, resolveLifecycleTransition } from "../_shared/abandonedCart.ts";

const SCOPE = "abandoned-cart-lifecycle";

Deno.serve(async (req) => {
  const corsHeaders = {
    ...getCorsHeaders(req.headers.get("Origin")),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const abandonedMinutes = Number(Deno.env.get("ABANDONED_CART_ABANDONED_MINUTES") || "30");
  const expireHours = Number(Deno.env.get("ABANDONED_CART_EXPIRE_HOURS") || "24");

  const abandonedCutoff = new Date(now.getTime() - abandonedMinutes * 60_000).toISOString();
  const expiredCutoff = new Date(now.getTime() - expireHours * 60 * 60_000).toISOString();

  const { data: candidates, error } = await supabase
    .from("abandoned_carts")
    .select("id, created_at, operational_status, last_activity_at, recovered, recovery_events")
    .neq("operational_status", "converted")
    .order("last_activity_at", { ascending: true })
    .limit(1000);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let updated = 0;

  for (const row of candidates || []) {
    if (row.recovered) continue;

    const lastActivity = row.last_activity_at || row.created_at;
    const toExpired = !!lastActivity && lastActivity <= expiredCutoff;
    const toAbandoned = !!lastActivity && lastActivity <= abandonedCutoff;

    const target = toExpired ? "expired" : toAbandoned ? "abandoned" : null;
    if (!target) continue;

    const transition = resolveLifecycleTransition({
      current: (row.operational_status as "active" | "abandoned" | "expired" | "converted" | null) ?? "active",
      target,
      nowIso: now.toISOString(),
    });

    if (!transition) continue;

    const updatePayload: Record<string, unknown> = {
      operational_status: transition.operational_status,
      last_activity_at: row.last_activity_at,
      recovery_events: appendRecoveryEvent(row.recovery_events, {
        at: now.toISOString(),
        type: "checkout_activity",
        note: `lifecycle:${transition.operational_status}`,
      }),
    };

    if (transition.abandoned_at) updatePayload.abandoned_at = transition.abandoned_at;
    if (transition.expired_at) updatePayload.expired_at = transition.expired_at;
    if (transition.converted_at) updatePayload.converted_at = transition.converted_at;

    const { error: updateError } = await supabase
      .from("abandoned_carts")
      .update(updatePayload)
      .eq("id", row.id)
      .neq("operational_status", "converted");

    if (!updateError) updated += 1;
  }

  console.log(JSON.stringify({ scope: SCOPE, updated, candidates: candidates?.length || 0, abandoned_minutes: abandonedMinutes, expire_hours: expireHours }));

  return new Response(JSON.stringify({ ok: true, updated }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
