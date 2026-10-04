/**
 * Super Admin — catálogo das integrações preservadas.
 * Acesso restrito a super_admin e owner.
 */
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, RefreshCw, Shield } from 'lucide-react';
import { useRequireSuperAdmin } from '@/hooks/useRequireSuperAdmin';

const API_CATALOG = [
  { name: 'Shopify', docs: null, purpose: 'Catálogo, estoque e operação comercial', functions: [] },
  { name: 'Stripe Billing', docs: null, purpose: 'Assinaturas da plataforma', functions: ['checkout-stripe-webhook'] },
];

export default function SuperAdmin() {
  const { isSuperAdmin, isLoading: authLoading } = useRequireSuperAdmin();

  if (!isSuperAdmin && !authLoading) return null;

  if (authLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Verificando permissão...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-6 animate-content-in">
      <div className="flex items-center gap-2">
        <Shield className="h-8 w-8 text-violet-600" />
        <div>
          <h1 className="text-2xl font-bold">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Catálogo das integrações preservadas da plataforma.</p>
        </div>
      </div>

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
