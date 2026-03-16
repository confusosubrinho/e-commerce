/**
 * Fase 5: Super Admin — dashboard de saúde e catálogo de APIs.
 * Acesso restrito a super_admin e owner.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, ExternalLink, Loader2, RefreshCw, Shield } from 'lucide-react';
import { useRequireSuperAdmin } from '@/hooks/useRequireSuperAdmin';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') + '/functions/v1';

const API_CATALOG = [
  { name: 'Stripe', docs: 'https://stripe.com/docs/api', purpose: 'Pagamentos (cartão, PIX)', functions: ['checkout-stripe-create-intent', 'checkout-stripe-webhook', 'checkout-stripe-catalog-sync', 'checkout-reprocess-stripe-webhook', 'checkout-reconcile-order'] },
  { name: 'Yampi', docs: 'https://docs.yampi.io', purpose: 'Checkout externo, catálogo, pedidos', functions: ['yampi-webhook', 'yampi-import-order', 'yampi-catalog-sync', 'yampi-sync-sku', 'yampi-sync-images', 'yampi-sync-variation-values', 'yampi-sync-categories'] },
  { name: 'Appmax', docs: null, purpose: 'Pagamento transparente', functions: ['appmax-webhook', 'appmax-authorize', 'appmax-get-app-token', 'appmax-generate-merchant-keys', 'appmax-healthcheck', 'appmax-healthcheck-ping'] },
  { name: 'Bling (ERP)', docs: 'https://developer.bling.com.br', purpose: 'Estoque e pedidos', functions: ['bling-webhook', 'bling-oauth', 'bling-sync', 'bling-sync-single-stock'] },
];

export default function SuperAdmin() {
  const { isSuperAdmin, isLoading: authLoading } = useRequireSuperAdmin();

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['commerce-health'],
    queryFn: async () => {
      const { data: d, error: e } = await supabase.rpc('commerce_health');
      if (e) throw e;
      return d as unknown as { ok?: boolean; error?: string; checks?: Record<string, unknown> };
    },
    staleTime: 60 * 1000,
  });

  const { data: failedWebhooks, isLoading: webhooksLoading } = useQuery({
    queryKey: ['commerce-health-failed-webhooks'],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Não autenticado');
      const res = await fetch(`${FUNCTIONS_URL}/admin-commerce-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'list_failed_webhook_events' }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) throw new Error(body?.error || 'Não autorizado');
      if (!res.ok) throw new Error(body?.error || res.statusText);
      return (body.events ?? []) as Array<{ event_id: string; event_type: string; error_message: string | null }>;
    },
    staleTime: 60 * 1000,
  });

  if (!isSuperAdmin && !authLoading) return null;

  if (authLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Verificando permissão...
      </div>
    );
  }

  const healthOk = health?.ok === true;
  const failedCount = failedWebhooks?.length ?? 0;
  const healthLoadingState = healthLoading || webhooksLoading;

  return (
    <div className="p-6 max-w-4xl space-y-6 animate-content-in">
      <div className="flex items-center gap-2">
        <Shield className="h-8 w-8 text-violet-600" />
        <div>
          <h1 className="text-2xl font-bold">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Visão de saúde e catálogo de APIs da plataforma.</p>
        </div>
      </div>

      {/* Dashboard de saúde */}
      <Card className={healthOk && failedCount === 0 ? 'border-green-500/50' : 'border-amber-500/50'}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              {healthLoadingState ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : healthOk && failedCount === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              Saúde do Commerce
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/commerce-health">
                Ver detalhes
                <ExternalLink className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {healthLoadingState ? (
            <p className="text-sm text-muted-foreground">Carregando checagens...</p>
          ) : (
            <>
              <p className="text-sm">
                {health?.error ? (
                  <span className="text-destructive">{health.error}</span>
                ) : healthOk ? (
                  <span className="text-muted-foreground">Checagens de integridade OK.</span>
                ) : (
                  <span className="text-amber-600">Há itens que precisam de atenção. Abra Commerce Health para detalhes.</span>
                )}
              </p>
              {failedCount > 0 && (
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {failedCount} webhook(s) Stripe com erro — reprocesse em Commerce Health.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Catálogo de APIs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Catálogo de APIs e integrações</CardTitle>
          <p className="text-sm text-muted-foreground">
            Integrações externas e Edge Functions relacionadas. Documentação completa em <code className="text-xs bg-muted px-1 rounded">docs/API_INVENTORY.md</code>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {API_CATALOG.map((api) => (
            <div key={api.name} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{api.name}</h3>
                {api.docs && (
                  <a
                    href={api.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Docs
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{api.purpose}</p>
              <div className="flex flex-wrap gap-1">
                {api.functions.map((fn) => (
                  <code key={fn} className="text-xs bg-muted px-2 py-0.5 rounded">
                    {fn}
                  </code>
                ))}
              </div>
            </div>
          ))}
          <div className="pt-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/integracoes">
                <RefreshCw className="h-4 w-4 mr-2" />
                Configurar integrações
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
