import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function logAppmax(
  supabase: any,
  level: string,
  message: string,
  meta?: Record<string, unknown>
) {
  try {
    await supabase
      .from("appmax_logs")
      .insert({ level, scope: "appmax", message, meta: meta ?? {} });
  } catch (_) {}
}

async function getAppToken(supabase: any): Promise<string> {
  const clientId = Deno.env.get("APPMAX_CLIENT_ID")!;
  const clientSecret = Deno.env.get("APPMAX_CLIENT_SECRET")!;
  const authBaseUrl = "https://auth.sandboxappmax.com.br";

  const res = await fetch(`${authBaseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    await logAppmax(supabase, "error", "Falha ao obter app token para generate-keys", {
      status: res.status,
    });
    throw new Error("Falha ao obter token do aplicativo");
  }
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
    authHeader.replace("Bearer ", "")
  );
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: claimsData.claims.sub,
    _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { external_key, token } = body;
    if (!external_key || !token) {
      throw new Error("external_key e token são obrigatórios");
    }

    const apiBaseUrl = "https://api.sandboxappmax.com.br";

    // Get app token
    const accessToken = await getAppToken(supabase);

    // Call /app/client/generate
    const generateRes = await fetch(`${apiBaseUrl}/app/client/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    });

    const generateData = await generateRes.json();

    if (!generateRes.ok) {
      await logAppmax(supabase, "error", "Falha em /app/client/generate", {
        status: generateRes.status,
        response: generateData,
      });

      // Update installation with error
      await supabase
        .from("appmax_installations")
        .update({
          status: "error",
          last_error: generateData.message || "Falha ao gerar credenciais",
        })
        .eq("external_key", external_key)
        .eq("environment", "sandbox");

      throw new Error(generateData.message || "Falha ao gerar credenciais do merchant");
    }

    const merchantClientId =
      generateData.client_id || generateData.data?.client_id;
    const merchantClientSecret =
      generateData.client_secret || generateData.data?.client_secret;

    if (!merchantClientId || !merchantClientSecret) {
      await logAppmax(supabase, "error", "Credenciais do merchant não retornadas", {
        response_keys: Object.keys(generateData),
      });
      throw new Error("Credenciais do merchant não retornadas pela Appmax");
    }

    // Update installation
    await supabase
      .from("appmax_installations")
      .update({
        merchant_client_id: merchantClientId,
        merchant_client_secret: merchantClientSecret,
        status: "connected",
        last_error: null,
      })
      .eq("external_key", external_key)
      .eq("environment", "sandbox");

    await logAppmax(supabase, "info", "Credenciais do merchant geradas com sucesso", {
      external_key,
      merchant_client_id: merchantClientId,
    });

    // NEVER return merchant_client_secret to frontend
    return new Response(
      JSON.stringify({ success: true, status: "connected" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    await logAppmax(supabase, "error", `Erro em appmax-generate-merchant-keys: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
