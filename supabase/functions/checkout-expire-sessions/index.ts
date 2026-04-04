/**
 * checkout-expire-sessions
 *
 * Expira checkout_sessions que passaram do prazo de validade (30 min por padrão)
 * sem ter gerado pagamento.
 *
 * Também cancela pedidos em status "pending" cuja checkout_session expirou e
 * libera o estoque reservado para esses pedidos (convert reserve → release).
 *
 * Deve ser chamada pelo pg_cron a cada 15 minutos.
 * Também pode ser chamada manualmente via POST com Authorization Bearer <service_role_key>.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const SCOPE = "checkout-expire-sessions";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Aceita tanto service_role_key quanto token de cron interno
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CHECKOUT_CRON_SECRET");

  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isServiceRole && !isCron) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey!,
  );

  const correlationId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  try {
    // 1. Expirar checkout_sessions vencidas via função SQL
    const { data: expiredCount, error: expireErr } = await supabase.rpc("expire_checkout_sessions");
    if (expireErr) {
      console.warn(`[${SCOPE}] expire_checkout_sessions RPC error:`, expireErr.message);
    }

    // 2. Buscar checkout_sessions recém-expiradas para cancelar pedidos vinculados
    const { data: expiredSessions } = await supabase
      .from("checkout_sessions")
      .select("id, order_id, tenant_id")
      .eq("status", "expired")
      .gte("updated_at", new Date(Date.now() - 20 * 60 * 1000).toISOString()) // expiradas nos últimos 20 min
      .not("order_id", "is", null);

    let cancelledOrders = 0;
    let stockReleased = 0;

    for (const session of expiredSessions ?? []) {
      if (!session.order_id) continue;

      // Busca o pedido — só cancela se ainda estiver pending
      const { data: order } = await supabase
        .from("orders")
        .select("id, status, tenant_id")
        .eq("id", session.order_id)
        .eq("status", "pending")
        .maybeSingle();

      if (!order) continue;

      const tenantId = order.tenant_id ?? session.tenant_id;

      // Libera estoque reservado (reserve → release)
      const { data: movements } = await supabase
        .from("inventory_movements")
        .select("id, variant_id, quantity, type")
        .eq("order_id", order.id)
        .eq("type", "reserve");

      for (const mov of movements ?? []) {
        // Verifica se já foi liberado
        const { data: alreadyReleased } = await supabase
          .from("inventory_movements")
          .select("id")
          .eq("order_id", order.id)
          .eq("variant_id", mov.variant_id)
          .eq("type", "release")
          .maybeSingle();

        if (!alreadyReleased) {
          await supabase.rpc("increment_stock", {
            p_variant_id: mov.variant_id,
            p_quantity: mov.quantity,
          });
          if (tenantId) {
            await supabase.from("inventory_movements").insert({
              tenant_id: tenantId,
              variant_id: mov.variant_id,
              order_id: order.id,
              type: "release",
              quantity: mov.quantity,
            });
          }
          stockReleased++;
        }
      }

      // Cancela o pedido
      await supabase
        .from("orders")
        .update({
          status: "cancelled",
          payment_status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "pending");

      cancelledOrders++;
    }

    const finishedAt = new Date().toISOString();
    console.log(
      JSON.stringify({
        level: "info",
        message: "checkout-expire-sessions completed",
        scope: SCOPE,
        correlation_id: correlationId,
        expired_sessions: expiredCount ?? 0,
        cancelled_orders: cancelledOrders,
        stock_released: stockReleased,
        started_at: startedAt,
        finished_at: finishedAt,
      }),
    );

    return new Response(
      JSON.stringify({
        ok: true,
        expired_sessions: expiredCount ?? 0,
        cancelled_orders: cancelledOrders,
        stock_released: stockReleased,
        correlation_id: correlationId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error(`[${SCOPE}] error:`, msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg, correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
