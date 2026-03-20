import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTenantIdFromRequest } from '../_shared/tenant.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Multi-tenant: tenant_id deve ser a tenant resolvida na request.
    // (Frontend/middleware deve enviar x-tenant-id; fallback: tenant default)
    const tenantId = getTenantIdFromRequest(req);

    // Dynamic base URL: evita cache cross-tenant e suporta domínios customizados.
    const hostHeader = req.headers.get('host') || '';
    const hostname = hostHeader.split(':')[0];
    const proto =
      (req.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim() || 'https';
    const siteUrl = hostname ? `${proto}://${hostname}` : 'https://example.com';

    const [products, categories] = await Promise.all([
      supabase.from('products')
        .select('slug, updated_at')
        .eq('is_active', true)
        .eq('tenant_id', tenantId),
      supabase.from('categories')
        .select('slug, updated_at')
        .eq('is_active', true)
        .eq('tenant_id', tenantId),
    ]);

    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/novidades', priority: '0.8', changefreq: 'daily' },
      { loc: '/promocoes', priority: '0.8', changefreq: 'daily' },
      { loc: '/mais-vendidos', priority: '0.8', changefreq: 'weekly' },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    for (const page of staticPages) {
      xml += `
  <url>
    <loc>${siteUrl}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    }

    for (const cat of categories.data || []) {
      xml += `
  <url>
    <loc>${siteUrl}/categoria/${cat.slug}</loc>
    <lastmod>${new Date(cat.updated_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    }

    for (const prod of products.data || []) {
      xml += `
  <url>
    <loc>${siteUrl}/produto/${prod.slug}</loc>
    <lastmod>${new Date(prod.updated_at).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
    }

    xml += `
</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        // Evita que CDNs cacheiem o sitemap de uma tenant para outra.
        'Cache-Control': 'private, max-age=3600',
        'Vary': 'Host',
      },
    });
  } catch (err) {
    return new Response(`Error: ${err instanceof Error ? err.message : String(err)}`, { status: 500, headers: corsHeaders });
  }
});
