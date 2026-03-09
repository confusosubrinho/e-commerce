/**
 * yampi-sync-order-status: Sincroniza status e dados de um pedido Yampi com o pedido local.
 * Busca o pedido na API Yampi pelo external_reference e atualiza status, pagamento, rastreio, método de envio e data da compra.
 * Requer autenticação de admin (JWT).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ ok: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return jsonRes({ ok: false, error: "Não autenticado" }, 401);

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) return jsonRes({ ok: false, error: "Token inválido" }, 401);

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return jsonRes({ ok: false, error: "Permissão negada" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonRes({ ok: false, error: "JSON inválido" }, 400);
  }

  const orderId = (body.order_id as string)?.trim();
  if (!orderId) return jsonRes({ ok: false, error: "Informe order_id (UUID do pedido local)" }, 400);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_number, external_reference, yampi_order_number, provider")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    return jsonRes({ ok: false, error: "Pedido não encontrado" }, 404);
  }
  if (order.provider !== "yampi" || !order.external_reference) {
    return jsonRes({ ok: false, error: "Pedido não é da Yampi ou não possui ID externo" }, 400);
  }

  const { data: yampiProvider } = await supabase
    .from("integrations_checkout_providers")
    .select("config, is_active")
    .eq("provider", "yampi")
    .maybeSingle();

  if (!yampiProvider || !yampiProvider.is_active) {
    return jsonRes({ ok: false, error: "Integração Yampi não está ativa" }, 400);
  }

  const config = yampiProvider.config as Record<string, unknown>;
  const alias = config?.alias as string;
  const userToken = config?.user_token as string;
  const userSecretKey = config?.user_secret_key as string;
  if (!alias || !userToken || !userSecretKey) {
    return jsonRes({ ok: false, error: "Credenciais Yampi incompletas" }, 400);
  }

  const baseUrl = `https://api.dooki.com.br/v2/${alias}`;
  const includeQuery = "include=items,customer,shipping_address,transactions";
  const headers = {
    "User-Token": userToken,
    "User-Secret-Key": userSecretKey,
    Accept: "application/json",
  };

  // --- Lookup helpers ---
  async function fetchById(id: string): Promise<Record<string, unknown> | null> {
    const url = `${baseUrl}/orders/${id}?${includeQuery}`;
    console.log(`[yampi-sync] GET ${url}`);
    try {
      const res = await fetchWithTimeout(url, { headers });
      console.log(`[yampi-sync] GET /orders/${id} → ${res.status}`);
      if (!res.ok) return null;
      const json = await res.json();
      return (json?.data as Record<string, unknown>) || null;
    } catch (e) {
      console.error(`[yampi-sync] fetchById(${id}) error:`, e);
      return null;
    }
  }

  async function fetchByNumber(num: string): Promise<Record<string, unknown> | null> {
    const url = `${baseUrl}/orders?${includeQuery}&number=${encodeURIComponent(num)}&limit=1`;
    console.log(`[yampi-sync] GET ${url}`);
    try {
      const res = await fetchWithTimeout(url, { headers });
      console.log(`[yampi-sync] GET /orders?number=${num} → ${res.status}`);
      if (!res.ok) return null;
      const json = await res.json();
      return (json?.data?.[0] as Record<string, unknown>) || null;
    } catch (e) {
      console.error(`[yampi-sync] fetchByNumber(${num}) error:`, e);
      return null;
    }
  }

  async function fetchBySearch(q: string): Promise<Record<string, unknown> | null> {
    const url = `${baseUrl}/orders?${includeQuery}&q=${encodeURIComponent(q)}&limit=5`;
    console.log(`[yampi-sync] GET ${url}`);
    try {
      const res = await fetchWithTimeout(url, { headers });
      if (!res.ok) return null;
      const json = await res.json();
      const orders = json?.data || [];
      return orders.find((o: Record<string, unknown>) =>
        String(o.id) === q || String(o.number) === q
      ) || orders[0] || null;
    } catch (e) {
      console.error(`[yampi-sync] fetchBySearch(${q}) error:`, e);
      return null;
    }
  }

  let yampiOrder: Record<string, unknown> | null = null;
  const extRef = order.external_reference;
  const yampiNum = order.yampi_order_number;

  try {
    // 1) GET direto por external_reference (pode ser ID Yampi)
    yampiOrder = await fetchById(extRef);

    // 2) GET direto por yampi_order_number (se diferente)
    if (!yampiOrder && yampiNum && yampiNum !== extRef) {
      yampiOrder = await fetchById(yampiNum);
    }

    // 3) Busca por number=external_reference (filtro exato)
    if (!yampiOrder) {
      yampiOrder = await fetchByNumber(extRef);
    }

    // 4) Busca por number=yampi_order_number
    if (!yampiOrder && yampiNum && yampiNum !== extRef) {
      yampiOrder = await fetchByNumber(yampiNum);
    }

    // 5) Fallback: search genérico (último recurso)
    if (!yampiOrder) {
      yampiOrder = await fetchBySearch(extRef);
    }
  } catch (err) {
    console.error("[yampi-sync] Fetch error:", err);
    return jsonRes({ ok: false, error: "Erro ao conectar com a API Yampi" }, 502);
  }

  console.log(`[yampi-sync] Lookup result for order ${order.order_number}: found=${!!yampiOrder}, yampi_id=${yampiOrder?.id ?? "null"}`);

  if (!yampiOrder) {
    return jsonRes({
      ok: false,
      error: "Pedido não encontrado na Yampi",
      hint: "Se importou pelo ID interno, tente importar de novo pelo número do pedido (ex.: 1491772375818422) que aparece no painel da Yampi.",
    }, 404);
  }

  const yampiStatus = String((yampiOrder.status as any)?.data?.alias || yampiOrder.status_alias || yampiOrder.status || "");
  let localStatus: string = "processing";
  if (["paid", "approved", "payment_approved", "processing", "in_production", "in_separation", "ready_for_shipping", "invoiced"].includes(yampiStatus)) localStatus = "processing";
  else if (["shipped", "sent"].includes(yampiStatus)) localStatus = "shipped";
  else if (["delivered"].includes(yampiStatus)) localStatus = "delivered";
  else if (["cancelled", "refused"].includes(yampiStatus)) localStatus = "cancelled";
  else if (["refunded"].includes(yampiStatus)) localStatus = "cancelled";
  else if (["pending", "waiting_payment"].includes(yampiStatus)) localStatus = "pending";

  const paymentStatusMap: Record<string, string> = {
    paid: "approved", approved: "approved", payment_approved: "approved",
    processing: "approved", in_production: "approved", in_separation: "approved",
    ready_for_shipping: "approved", invoiced: "approved",
    pending: "pending", waiting_payment: "pending",
    cancelled: "failed", refused: "failed", refunded: "refunded",
  };
  const transactions = ((yampiOrder.transactions as Record<string, unknown>)?.data as unknown[]) || (yampiOrder.transactions as unknown[]) || [];
  const firstTx = (transactions[0] as Record<string, unknown>) || {};
  const txStatus = (firstTx.status as string)?.toLowerCase() || yampiStatus;
  const paymentStatus = paymentStatusMap[txStatus] || paymentStatusMap[yampiStatus] || (localStatus === "pending" ? "pending" : localStatus === "cancelled" ? "failed" : "approved");

  const trackingCode = (yampiOrder.tracking_code as string) || null;
  const shippingOption = (yampiOrder.shipping_option as Record<string, unknown>) || {};
  const shippingMethodName = (yampiOrder.shipping_option_name as string) ||
    (shippingOption.name as string) ||
    ((yampiOrder.delivery_option as Record<string, unknown>)?.name as string) ||
    (yampiOrder.shipping_method as string) ||
    null;

  const yampiOrderDate = (yampiOrder.created_at as string) || (yampiOrder.date as string) || (yampiOrder.order_date as string) || (yampiOrder.updated_at as string) || null;
  let yampiCreatedAt: string | null = null;
  if (yampiOrderDate) {
    const d = new Date(yampiOrderDate);
    if (!isNaN(d.getTime())) yampiCreatedAt = d.toISOString();
    else console.warn("[yampi-sync] Invalid date ignored:", yampiOrderDate);
  }
  const yampiOrderNumber = (yampiOrder.number != null ? String(yampiOrder.number) : null) || (yampiOrder.order_number != null ? String(yampiOrder.order_number) : null) || null;

  // Fetch current order status to detect transitions
  const { data: currentOrder } = await supabase
    .from("orders")
    .select("status")
    .eq("id", order.id)
    .single();
  const oldStatus = currentOrder?.status;

  // If transitioning to cancelled, use RPC to restore stock
  if (localStatus === "cancelled" && oldStatus !== "cancelled") {
    const { data: rpcResult, error: rpcErr } = await supabase.rpc("cancel_order_return_stock", { p_order_id: order.id });
    if (rpcErr) {
      console.error("[yampi-sync] cancel_order_return_stock error:", rpcErr.message);
      return jsonRes({ ok: false, error: rpcErr.message || "Erro ao cancelar e devolver estoque" }, 500);
    }
    // Update remaining fields that RPC doesn't set
    await supabase.from("orders").update({
      payment_status: paymentStatus,
      tracking_code: trackingCode,
      shipping_method: shippingMethodName,
      yampi_created_at: yampiCreatedAt,
      yampi_order_number: yampiOrderNumber,
    }).eq("id", order.id);
  } else {
    // Extract transaction details
    const txPaymentMethod = (firstTx.payment_method as string) || (yampiOrder.payment_method as string) || null;
    const txGateway = (firstTx.gateway as string) || (yampiOrder.gateway as string) || null;
    const txInstallments = firstTx.installments ? Number(firstTx.installments) : (yampiOrder.installments ? Number(yampiOrder.installments) : null);
    const txTransactionId = (firstTx.transaction_id as string) || (yampiOrder.transaction_id as string) || null;
    const txShippingCost = yampiOrder.value_shipment != null ? Number(yampiOrder.value_shipment) : (yampiOrder.shipping_cost != null ? Number(yampiOrder.shipping_cost) : null);

    const updatePayload: Record<string, unknown> = {
      status: localStatus,
      payment_status: paymentStatus,
      tracking_code: trackingCode,
      shipping_method: shippingMethodName,
      yampi_created_at: yampiCreatedAt,
      yampi_order_number: yampiOrderNumber,
    };
    // Only set transaction fields if they have values (avoid overwriting with null)
    if (txPaymentMethod) updatePayload.payment_method = txPaymentMethod;
    if (txGateway) updatePayload.gateway = txGateway;
    if (txInstallments) updatePayload.installments = txInstallments;
    if (txTransactionId) updatePayload.transaction_id = txTransactionId;
    if (txShippingCost != null) updatePayload.shipping_cost = txShippingCost;

    const { error: updateErr } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", order.id);

    if (updateErr) {
      console.error("[yampi-sync] Update error:", updateErr?.message);
      return jsonRes({ ok: false, error: updateErr?.message || "Erro ao atualizar pedido" }, 500);
    }
  }

  console.log(`[yampi-sync] Order ${order.order_number} synced: status=${localStatus}, payment_status=${paymentStatus}`);
  return jsonRes({
    ok: true,
    order_id: order.id,
    order_number: order.order_number,
    status: localStatus,
    payment_status: paymentStatus,
    yampi_created_at: yampiCreatedAt,
    yampi_order_number: yampiOrderNumber,
  });
});
