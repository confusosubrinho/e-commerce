import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { provider } = await req.json();

    if (provider === "yampi") {
      const { data: providerConfig } = await supabase
        .from("integrations_checkout_providers")
        .select("config")
        .eq("provider", "yampi")
        .single();

      if (!providerConfig?.config) {
        const log = { provider: "yampi", status: "error", message: "Provider Yampi não encontrado no banco" };
        await supabase.from("integrations_checkout_test_logs").insert(log);
        return new Response(JSON.stringify(log), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const config = providerConfig.config as Record<string, unknown>;
      const alias = config.alias as string;
      const userToken = config.user_token as string;
      const userSecretKey = config.user_secret_key as string;

      if (!alias || !userToken || !userSecretKey) {
        const log = { provider: "yampi", status: "error", message: "Credenciais incompletas: alias, user_token ou user_secret_key ausentes" };
        await supabase.from("integrations_checkout_test_logs").insert(log);
        return new Response(JSON.stringify(log), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 1) Validação canônica de credenciais (docs Yampi): POST /auth/me
      const authRes = await fetchWithTimeout(`https://api.dooki.com.br/v2/${alias}/auth/me`, {
        method: "POST",
        headers: {
          "User-Token": userToken,
          "User-Secret-Key": userSecretKey,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }, 15_000);

      const authData = await authRes.json().catch(() => null);
      if (!authRes.ok) {
        const log = {
          provider: "yampi",
          status: "error",
          message: `Auth Yampi falhou em /auth/me (${authRes.status})`,
          payload_preview: { status: authRes.status, body: authData },
        };
        await supabase.from("integrations_checkout_test_logs").insert(log);
        return new Response(JSON.stringify(log), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2) Smoke de permissão de catálogo (opcional, melhora diagnóstico)
      const catalogRes = await fetchWithTimeout(`https://api.dooki.com.br/v2/${alias}/catalog/products?limit=1`, {
        headers: {
          "User-Token": userToken,
          "User-Secret-Key": userSecretKey,
          Accept: "application/json",
        },
      }, 15_000);

      const catalogData = await catalogRes.json().catch(() => null);

      if (catalogRes.ok) {
        const log = {
          provider: "yampi",
          status: "success",
          message: `Conexão OK (/auth/me + catálogo). ${catalogData?.data?.length || 0} produto(s) encontrado(s).`,
          payload_preview: {
            auth_me_status: authRes.status,
            catalog_status: catalogRes.status,
            products_count: catalogData?.data?.length || 0,
          },
        };
        await supabase.from("integrations_checkout_test_logs").insert(log);
        return new Response(JSON.stringify(log), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const log = {
          provider: "yampi",
          status: "partial",
          message: `Credenciais válidas em /auth/me, mas catálogo retornou ${catalogRes.status}`,
          payload_preview: {
            auth_me_status: authRes.status,
            catalog_status: catalogRes.status,
            catalog_body: catalogData,
          },
        };
        await supabase.from("integrations_checkout_test_logs").insert(log);
        return new Response(JSON.stringify(log), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ error: `Provider '${provider}' não suportado para teste` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
