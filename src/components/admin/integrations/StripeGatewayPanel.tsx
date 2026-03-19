import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Eye, EyeOff, Upload } from 'lucide-react';

export function StripeGatewayPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [publishableKey, setPublishableKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [syncingStripeCatalog, setSyncingStripeCatalog] = useState(false);
  const [stripeSyncProgress, setStripeSyncProgress] = useState('');

  const { data: provider, isLoading } = useQuery({
    queryKey: ['stripe-provider'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integrations_checkout_providers')
        .select('*')
        .eq('provider', 'stripe')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (provider) {
      const config = (provider.config || {}) as Record<string, string>;
      setPublishableKey(config.publishable_key || '');
      setSecretKey(config.secret_key || '');
    }
  }, [provider]);

  const handleSave = async () => {
    if (!publishableKey.startsWith('pk_')) {
      toast({ title: 'Chave inválida', description: 'A Publishable Key deve começar com pk_', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const existingConfig = (provider?.config || {}) as Record<string, unknown>;
      const payload = {
        provider: 'stripe',
        display_name: 'Stripe',
        is_active: true,
        config: { ...existingConfig, publishable_key: publishableKey, secret_key: secretKey.trim() || undefined },
        updated_at: new Date().toISOString(),
      };
      if (provider?.id) {
        const { error } = await supabase
          .from('integrations_checkout_providers')
          .update(payload)
          .eq('id', provider.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('integrations_checkout_providers')
          .insert(payload);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['stripe-provider'] });
      toast({ title: 'Stripe configurado!' });
    } catch (err: unknown) {
      toast({ title: 'Erro ao salvar', description: err instanceof Error ? err.message : 'Erro', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!provider?.id) return;
    try {
      await supabase
        .from('integrations_checkout_providers')
        .update({ is_active: !provider.is_active })
        .eq('id', provider.id);
      queryClient.invalidateQueries({ queryKey: ['stripe-provider'] });
      toast({ title: provider.is_active ? 'Stripe desativado' : 'Stripe ativado' });
    } catch (err: unknown) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Erro', variant: 'destructive' });
    }
  };

  const handleSetAsDefault = async () => {
    try {
      const { data: checkoutConfig } = await supabase
        .from('integrations_checkout')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (checkoutConfig?.id) {
        await supabase.from('integrations_checkout').update({
          provider: 'stripe',
          enabled: true,
        }).eq('id', checkoutConfig.id);
      } else {
        await supabase.from('integrations_checkout').insert({
          provider: 'stripe',
          enabled: true,
        });
      }
      toast({ title: 'Stripe definido como provedor padrão de pagamento!' });
    } catch (err: unknown) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Erro', variant: 'destructive' });
    }
  };

  const runStripeCatalogSync = async () => {
    if (syncingStripeCatalog) return;
    setSyncingStripeCatalog(true);
    setStripeSyncProgress('Iniciando...');
    let offset = 0;
    const batchSize = 10;
    let totalProducts = 0;
    let totalPrices = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    try {
      while (true) {
        setStripeSyncProgress(`Enviando produtos ${offset + 1}-${offset + batchSize}...`);
        const { data, error } = await supabase.functions.invoke('checkout-stripe-catalog-sync', {
          body: { only_active: true, offset, limit: batchSize },
        });
        if (error) throw error;
        totalProducts += data?.created_products ?? 0;
        totalPrices += data?.created_prices ?? 0;
        totalUpdated += data?.updated_products ?? 0;
        totalErrors += data?.errors_count ?? 0;
        const processed = data?.processed ?? 0;
        setStripeSyncProgress(`${offset + processed} produtos processados`);
        if (!data?.has_more) break;
        offset += batchSize;
      }
      setStripeSyncProgress('');
      toast({
        title: 'Catálogo Stripe sincronizado!',
        description: `${totalProducts} produtos criados, ${totalPrices} preços criados, ${totalUpdated} produtos atualizados${totalErrors > 0 ? `, ${totalErrors} erros` : ''}.`,
        variant: totalErrors > 0 ? 'destructive' : 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['stripe-provider'] });
    } catch (err: unknown) {
      setStripeSyncProgress('');
      toast({
        title: 'Erro ao sincronizar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSyncingStripeCatalog(false);
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={provider?.is_active ? 'default' : 'secondary'} className="text-xs">
            {provider?.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
        {provider?.id && (
          <Switch checked={provider.is_active} onCheckedChange={handleToggleActive} />
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Publishable Key (pk_...)</Label>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={publishableKey}
              onChange={e => setPublishableKey(e.target.value)}
              placeholder="pk_live_... ou pk_test_..."
              className="text-xs h-8 pr-8 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Encontre no <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline">Stripe Dashboard → API Keys</a>.
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Secret Key (sk_...)</Label>
          <div className="relative">
            <Input
              type={showSecretKey ? 'text' : 'password'}
              value={secretKey}
              onChange={e => setSecretKey(e.target.value)}
              placeholder="sk_live_... ou sk_test_..."
              className="text-xs h-8 pr-8 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowSecretKey(!showSecretKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecretKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Necessária para criar sessões de checkout e sincronizar o catálogo. Mantenha em sigilo.
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Catálogo no Stripe</Label>
          <p className="text-[10px] text-muted-foreground mb-1">
            Envia produtos ativos e variantes para o catálogo do Stripe (Products e Prices). Salve as chaves antes.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={runStripeCatalogSync}
            disabled={syncingStripeCatalog || !secretKey.trim()}
            className="w-full"
          >
            {syncingStripeCatalog ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {syncingStripeCatalog ? stripeSyncProgress || 'Sincronizando...' : 'Sincronizar catálogo Stripe'}
          </Button>
        </div>

        <div className="bg-muted/60 border rounded-md p-2.5 text-xs text-muted-foreground space-y-1">
          <p><strong>Webhook URL:</strong> Configure no Stripe Dashboard:</p>
          <code className="block bg-muted px-2 py-1 rounded font-mono text-[10px] break-all">
            https://{import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/checkout-stripe-webhook
          </code>
          <p className="text-[10px]">Eventos: <code>payment_intent.succeeded</code>, <code>payment_intent.payment_failed</code></p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} size="sm" className="flex-1">
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : <><Save className="h-4 w-4 mr-2" />Salvar</>}
        </Button>
        <Button onClick={handleSetAsDefault} variant="outline" size="sm">
          Definir como padrão
        </Button>
      </div>
    </div>
  );
}
