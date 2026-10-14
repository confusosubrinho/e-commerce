import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService, authErrorResponse } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/response.ts";

const SCOPE = "publish-content-snapshot";
const BUCKET = "site-content";
const OBJECT_PATH = "content-snapshot.json";

// Mantenha em sincronia com as chaves de src/data/contentSnapshot.json.
const TABLES = [
  "announcement_bar",
  "banners",
  "blog_posts",
  "blog_settings",
  "categories",
  "features_bar",
  "help_articles",
  "highlight_banners",
  "home_page_sections",
  "home_sections",
  "homepage_testimonials",
  "homepage_testimonials_config",
  "instagram_videos",
  "page_contents",
  "payment_methods_display",
  "payment_pricing_config",
  "security_seals",
  "site_theme",
  "social_links",
  "store_settings_public",
];

serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return errorResponse("Método não permitido", 405, cors);

  const auth = await requireAdminOrService(req);
  if (!auth.ok) return authErrorResponse(auth, cors, SCOPE);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Lê com a chave pública para publicar exatamente o que um visitante pode ver (RLS).
  const snapshot: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!res.ok) {
      console.error(`[${SCOPE}] ${table}: HTTP ${res.status} ${await res.text()}`);
      return errorResponse(`Falha ao ler ${table}`, 502, cors);
    }
    snapshot[table] = await res.json();
  }

  const admin = createClient(url, serviceKey);
  const { error: bucketError } = await admin.storage.getBucket(BUCKET);
  if (bucketError) {
    const { error } = await admin.storage.createBucket(BUCKET, { public: true });
    if (error && !/already exists/i.test(error.message)) {
      console.error(`[${SCOPE}] createBucket: ${error.message}`);
      return errorResponse("Falha ao preparar armazenamento", 500, cors);
    }
  }

  const publishedAt = new Date().toISOString();
  const body = JSON.stringify({ published_at: publishedAt, tables: snapshot });
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(OBJECT_PATH, new Blob([body], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
      cacheControl: "30",
    });
  if (uploadError) {
    console.error(`[${SCOPE}] upload: ${uploadError.message}`);
    return errorResponse("Falha ao publicar conteúdo", 500, cors);
  }

  console.log(`[${SCOPE}] published by ${auth.userId ?? "service"} at ${publishedAt}`);
  return successResponse({ published_at: publishedAt, tables: snapshot }, cors);
});
