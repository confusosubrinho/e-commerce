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

function getPagination(data: Record<string, unknown> | null | undefined): Record<string, unknown> | undefined {
  const meta = data?.meta as Record<string, unknown> | undefined;
  const direct = meta?.pagination as Record<string, unknown> | undefined;
  const nested = (meta?.meta as Record<string, unknown> | undefined)?.pagination as Record<string, unknown> | undefined;
  return direct ?? nested;
}

async function yampiRequest(
  baseUrl: string,
  headers: Record<string, string>,
  path: string,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null }> {
  const res = await fetchWithTimeout(`${baseUrl}${path}`, { method: "GET", headers }, 25_000);
  let data: Record<string, unknown> | null = null;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

async function yampiPaginatedGet(
  baseUrl: string,
  headers: Record<string, string>,
  path: string,
  limit = 50,
  maxPages = 20,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let page = 1;

  while (page <= maxPages) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await yampiRequest(baseUrl, headers, `${path}${sep}limit=${limit}&page=${page}`);
    if (!res.ok) break;

    const rows = Array.isArray(res.data?.data) ? (res.data?.data as Record<string, unknown>[]) : [];
    all.push(...rows);

    const pagination = getPagination(res.data);
    const current = Number(pagination?.current_page ?? page);
    const totalPagesRaw = Number(pagination?.total_pages ?? 0);
    const perPage = Number(pagination?.per_page ?? limit);
    const total = Number(pagination?.total ?? all.length);
    const totalPages = totalPagesRaw > 0 ? totalPagesRaw : Math.max(1, Math.ceil(total / Math.max(1, perPage)));
    if (current >= totalPages) break;
    page = current + 1;
  }

  return all;
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

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const syncCheckout = body.sync_checkout !== false;
  const syncStore = body.sync_store !== false;
  const syncPhotos = body.sync_photos !== false;

  const { data: providerRow } = await supabase
    .from("integrations_checkout_providers")
    .select("id, config, is_active")
    .eq("provider", "yampi")
    .maybeSingle();

  if (!providerRow || !providerRow.is_active) {
    return jsonRes({ ok: false, error: "Integração Yampi não está ativa" }, 400);
  }

  const config = (providerRow.config || {}) as Record<string, unknown>;
  const alias = config.alias as string;
  const userToken = config.user_token as string;
  const userSecretKey = config.user_secret_key as string;

  if (!alias || !userToken || !userSecretKey) {
    return jsonRes({ ok: false, error: "Credenciais Yampi incompletas (alias, user_token, user_secret_key)" }, 400);
  }

  const baseUrl = `https://api.dooki.com.br/v2/${alias}`;
  const headers = {
    "User-Token": userToken,
    "User-Secret-Key": userSecretKey,
    Accept: "application/json",
  };

  const remoteConfigSync =
    (config.remote_config_sync as Record<string, unknown> | undefined) || {};

  const result: Record<string, unknown> = {
    ok: true,
    synced_at: new Date().toISOString(),
    checkout: null,
    store_data: null,
    overview: null,
    photos_count: 0,
    warnings: [] as string[],
  };

  if (syncCheckout) {
    const checkoutRes = await yampiRequest(baseUrl, headers, "/config/checkout");
    if (checkoutRes.ok) {
      result.checkout = checkoutRes.data?.data ?? checkoutRes.data;
      remoteConfigSync.checkout = result.checkout;
    } else {
      (result.warnings as string[]).push(`Falha ao sincronizar /config/checkout (${checkoutRes.status})`);
    }
  }

  if (syncStore) {
    const storeRes = await yampiRequest(baseUrl, headers, "/config/store-data");
    if (storeRes.ok) {
      result.store_data = storeRes.data?.data ?? storeRes.data;
      remoteConfigSync.store_data = result.store_data;
    } else {
      (result.warnings as string[]).push(`Falha ao sincronizar /config/store-data (${storeRes.status})`);
    }

    const overviewRes = await yampiRequest(baseUrl, headers, "/config/overview");
    if (overviewRes.ok) {
      result.overview = overviewRes.data?.data ?? overviewRes.data;
      remoteConfigSync.overview = result.overview;
    } else {
      (result.warnings as string[]).push(`Falha ao sincronizar /config/overview (${overviewRes.status})`);
    }
  }

  if (syncPhotos) {
    const photos = await yampiPaginatedGet(baseUrl, headers, "/config/photos");
    result.photos_count = photos.length;
    remoteConfigSync.photos = photos;
  }

  remoteConfigSync.synced_at = result.synced_at;
  remoteConfigSync.synced_by = user.id;

  const nextConfig = {
    ...config,
    remote_config_sync: remoteConfigSync,
  };

  const { error: updateErr } = await supabase
    .from("integrations_checkout_providers")
    .update({ config: nextConfig })
    .eq("id", providerRow.id);

  if (updateErr) {
    return jsonRes({ ok: false, error: updateErr.message }, 500);
  }

  await supabase.from("integrations_checkout_test_logs").insert({
    provider: "yampi",
    status: (result.warnings as string[]).length ? "partial" : "success",
    message: `Sync config Yampi executado: checkout=${syncCheckout}, store=${syncStore}, photos=${syncPhotos}`,
    payload_preview: {
      warnings: result.warnings,
      photos_count: result.photos_count,
      synced_at: result.synced_at,
    },
  });

  return jsonRes(result, 200);
});
