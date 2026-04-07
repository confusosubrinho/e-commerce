import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidTokenSafe } from "../_shared/blingTokenRefresh.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { parseRequestedTenantId, resolveAdminTenantContext } from "../_shared/blingTenant.ts";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

interface BlingOauthStatePayload {
  tenant_id: string;
  user_id: string;
  iat: number;
  nonce: string;
  origin?: string | null;
}

function toBase64Url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return atob(padded);
}

async function signStatePayload(payloadB64: string): Promise<string> {
  const secret = Deno.env.get("BLING_OAUTH_STATE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("BLING_OAUTH_STATE_SECRET não configurado");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return toBase64Url(String.fromCharCode(...new Uint8Array(signature)));
}

async function encodeOauthState(payload: BlingOauthStatePayload): Promise<string> {
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const sigB64 = await signStatePayload(payloadB64);
  return `${payloadB64}.${sigB64}`;
}

async function decodeAndVerifyOauthState(rawState: string | null): Promise<BlingOauthStatePayload> {
  if (!rawState || !rawState.includes(".")) throw new Error("state inválido");
  const [payloadB64, sigB64] = rawState.split(".", 2);
  const expectedSig = await signStatePayload(payloadB64);
  if (sigB64 !== expectedSig) throw new Error("state inválido");
  const decoded = fromBase64Url(payloadB64);
  const parsed = JSON.parse(decoded) as BlingOauthStatePayload;
  if (!parsed?.tenant_id || !parsed?.user_id || !parsed?.iat) throw new Error("state inválido");
  if (Date.now() - parsed.iat > OAUTH_STATE_TTL_MS) throw new Error("state expirado");
  return parsed;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ─── Handle OAuth callback from Bling (public — needed for redirect) ───
    if (action === "callback" || url.searchParams.has("code")) {
      const code = url.searchParams.get("code");
      let statePayload: BlingOauthStatePayload;

      if (!code) {
        return new Response("Código de autorização não recebido", { status: 400 });
      }
      try {
        statePayload = await decodeAndVerifyOauthState(url.searchParams.get("state"));
      } catch (err: any) {
        return new Response(`State OAuth inválido: ${err.message}`, { status: 400 });
      }

      const { data: settings } = await supabase
        .from("store_settings")
        .select("id, tenant_id, bling_client_id, bling_client_secret")
        .eq("tenant_id", statePayload.tenant_id)
        .limit(1)
        .maybeSingle();

      if (!settings?.bling_client_id || !settings?.bling_client_secret) {
        return new Response("Client ID e Secret do Bling não configurados", { status: 400 });
      }

      const basicAuth = btoa(`${settings.bling_client_id}:${settings.bling_client_secret}`);

      const tokenResponse = await fetch("https://api.bling.com.br/Api/v3/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/json",
        },
        body: new URLSearchParams({ grant_type: "authorization_code", code }),
      });

      const tokenData = await tokenResponse.json();
      console.log(`[bling-oauth] Token exchange status=${tokenResponse.status}, tenant_id=${statePayload.tenant_id}`);

      if (!tokenResponse.ok || !tokenData.access_token) {
        console.error("[bling-oauth] Token exchange failed", {
          tenant_id: statePayload.tenant_id,
          status: tokenResponse.status,
          error: tokenData?.error || null,
          error_description: tokenData?.error_description || null,
        });
        return new Response(
          `<html><body><h2>Erro na autorização do Bling</h2><p>${tokenData.error_description || tokenData.error || "Erro desconhecido"}</p><script>setTimeout(()=>window.close(),5000)</script></body></html>`,
          { status: 400, headers: { "Content-Type": "text/html" } }
        );
      }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 21600) * 1000).toISOString();

      await supabase
        .from("store_settings")
        .update({
          bling_access_token: tokenData.access_token,
          bling_refresh_token: tokenData.refresh_token,
          bling_token_expires_at: expiresAt,
        } as any)
        .eq("id", settings.id)
        .eq("tenant_id", statePayload.tenant_id);

      const openerTarget = statePayload.origin ? JSON.stringify(statePayload.origin) : "null";

      return new Response(
        `<html>
          <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0fdf4">
            <div style="text-align:center">
              <h2 style="color:#16a34a">✅ Bling conectado com sucesso!</h2>
              <p>Você pode fechar esta janela.</p>
              <script>
                const openerTarget=${openerTarget};
                if(window.opener && openerTarget){window.opener.postMessage('bling_connected', openerTarget)}
                setTimeout(()=>window.close(),3000)
              </script>
            </div>
          </body>
        </html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // ─── POST actions require admin JWT ───
    if (req.method === "POST") {
      // Validate admin auth
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = user.id;
      const body = await req.json();
      const requestedTenantId = parseRequestedTenantId(req, body);
      const tenantCtx = await resolveAdminTenantContext(supabase, userId, requestedTenantId);
      const tenantId = tenantCtx.tenantId;

      const { data: adminCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminCheck) {
        const { data: memberCheck } = await supabase
          .from("admin_members")
          .select("role")
          .eq("user_id", userId)
          .eq("tenant_id", tenantId)
          .in("role", ["super_admin", "owner", "manager", "operator", "admin"])
          .eq("is_active", true)
          .maybeSingle();
        if (!memberCheck) {
          return new Response(JSON.stringify({ error: "Acesso negado" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // ─── Generate authorization URL ───
      if (body.action === "get_auth_url") {
        const { data: settings } = await supabase
          .from("store_settings")
          .select("bling_client_id")
          .eq("tenant_id", tenantId)
          .limit(1)
          .maybeSingle();

        if (!settings?.bling_client_id) {
          return new Response(
            JSON.stringify({ error: "Configure o Client ID do Bling primeiro" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const callbackUrl = `${supabaseUrl}/functions/v1/bling-oauth`;
        const state = await encodeOauthState({
          tenant_id: tenantId,
          user_id: userId,
          iat: Date.now(),
          nonce: crypto.randomUUID(),
          origin: req.headers.get("Origin"),
        });
        const authUrl = `https://bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${settings.bling_client_id}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}`;

        return new Response(
          JSON.stringify({ auth_url: authUrl, callback_url: callbackUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── Refresh token (uses shared optimistic locking) ───
      if (body.action === "refresh_token") {
        try {
          await getValidTokenSafe(supabase, { tenantId });
          // Read updated expiry
          const { data: updated } = await supabase
            .from("store_settings")
            .select("bling_token_expires_at")
            .eq("tenant_id", tenantId)
            .limit(1)
            .maybeSingle();

          return new Response(
            JSON.stringify({ success: true, expires_at: updated?.bling_token_expires_at }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: err.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // ─── Check connection status ───
      if (body.action === "check_status") {
        const { data: settings } = await supabase
          .from("store_settings")
          .select("bling_access_token, bling_token_expires_at")
          .eq("tenant_id", tenantId)
          .limit(1)
          .maybeSingle();

        const isConnected = !!settings?.bling_access_token;
        const isExpired = settings?.bling_token_expires_at
          ? new Date(settings.bling_token_expires_at as string) < new Date()
          : true;

        return new Response(
          JSON.stringify({ connected: isConnected, expired: isExpired }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── Disconnect Bling ───
      if (body.action === "disconnect") {
        await supabase
          .from("store_settings")
          .update({
            bling_access_token: null,
            bling_refresh_token: null,
            bling_token_expires_at: null,
          } as any)
          .eq("tenant_id", tenantId);

        return new Response(
          JSON.stringify({ success: true, message: "Bling desconectado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Bling OAuth error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
