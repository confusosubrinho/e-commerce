import { ExternalLink } from 'lucide-react';
import { SHOPIFY_ADMIN_URL } from '@/lib/shopify/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Integrations() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-muted-foreground">Operação comercial gerenciada pela Shopify.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Shopify</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p>Gerencie produtos, estoque, descontos, pagamentos e frete na Shopify.</p>
          <Button asChild>
            <a href={SHOPIFY_ADMIN_URL} target="_blank" rel="noopener noreferrer">
              Abrir Shopify <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
