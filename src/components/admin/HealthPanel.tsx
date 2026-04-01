import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { REFETCH_MS, refetchIntervalWhenVisible } from '@/lib/queryRefetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, CheckCircle, Clock, Database, Server, Wifi, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SLA_MINUTES = { bling_webhook: 60, bling_cron: 15, errors_threshold: 10 };

export function HealthPanel() {
  const { data: lastWebhook } = useQuery<{ received_at?: string; result?: string } | null>({
    queryKey: ['health-last-webhook'],
    queryFn: async () => {
      const { data } = await supabase.from('bling_webhook_logs').select('received_at, result').order('received_at', { ascending: false }).limit(1).maybeSingle();
      return data as { received_at?: string; result?: string } | null;
    },
    refetchInterval: refetchIntervalWhenVisible(REFETCH_MS.adminHealthRecent),
  });
  const { data: lastCron } = useQuery<{ started_at?: string; errors_count?: number; trigger_type?: string } | null>({
    queryKey: ['health-last-cron'],
    queryFn: async () => {
      const { data } = await supabase.from('bling_sync_runs').select('started_at, finished_at, errors_count, trigger_type').order('started_at', { ascending: false }).limit(1).maybeSingle();
      return data as { started_at?: string; errors_count?: number; trigger_type?: string } | null;
    },
    refetchInterval: refetchIntervalWhenVisible(REFETCH_MS.adminHealthRecent),
  });
  const { data: errorCount24h } = useQuery<number>({
    queryKey: ['health-errors-24h'],
    queryFn: async () => {
      const since = new Date(Date.now() - 86400000).toISOString();
      const { count } = await supabase.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', since);
      return count || 0;
    },
    refetchInterval: refetchIntervalWhenVisible(REFETCH_MS.adminHealthAggregate),
  });
  const { data: appLogErrors } = useQuery<number>({
    queryKey: ['health-app-log-errors'],
    queryFn: async () => {
      const since = new Date(Date.now() - 86400000).toISOString();
      const { count } = await supabase.from('app_logs').select('id', { count: 'exact', head: true }).in('level', ['error', 'critical']).gte('created_at', since);
      return count || 0;
    },
    refetchInterval: refetchIntervalWhenVisible(REFETCH_MS.adminHealthAggregate),
  });
  const { data: productStats } = useQuery<{ active: number; total: number; pending: number }>({
    queryKey: ['health-product-stats'],
    queryFn: async () => {
      const [a, t, p] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('bling_sync_status', 'pending'),
      ]);
      return { active: a.count || 0, total: t.count || 0, pending: p.count || 0 };
    },
    refetchInterval: refetchIntervalWhenVisible(REFETCH_MS.adminHealthAggregate),
  });

  const totalErrors = (errorCount24h || 0) + (appLogErrors || 0);
  const webhookAge = lastWebhook?.received_at ? Math.floor((Date.now() - new Date(lastWebhook.received_at).getTime()) / 60000) : null;
  const cronAge = lastCron?.started_at ? Math.floor((Date.now() - new Date(lastCron.started_at).getTime()) / 60000) : null;
  const statusConfig = {
    healthy: { label: 'Saudável', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle className="h-6 w-6 text-green-600" /> },
    warning: { label: 'Atenção', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <AlertTriangle className="h-6 w-6 text-yellow-600" /> },
    critical: { label: 'Crítico', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-6 w-6 text-red-600" /> },
    unknown: { label: 'Desconhecido', color: 'bg-muted text-muted-foreground', icon: <Server className="h-6 w-6 text-muted-foreground" /> },
  };
  const checks = [
    { name: 'Bling Webhook', status: webhookAge === null ? 'unknown' : webhookAge <= SLA_MINUTES.bling_webhook ? 'healthy' : 'warning', detail: lastWebhook?.received_at ? `Último: ${formatDistanceToNow(new Date(lastWebhook.received_at), { addSuffix: true, locale: ptBR })}` : 'Sem dados', icon: <Wifi className="h-5 w-5" /> },
    { name: 'Sync Automático', status: cronAge === null ? 'unknown' : cronAge <= SLA_MINUTES.bling_cron ? 'healthy' : cronAge <= 30 ? 'warning' : 'critical', detail: lastCron ? `${lastCron.trigger_type ?? 'cron'} — ${formatDistanceToNow(new Date(lastCron.started_at!), { addSuffix: true, locale: ptBR })}${(lastCron.errors_count ?? 0) > 0 ? ` (${lastCron.errors_count} erros)` : ''}` : 'Nunca executou', icon: <Clock className="h-5 w-5" /> },
    { name: 'Erros (24h)', status: totalErrors === 0 ? 'healthy' : totalErrors <= SLA_MINUTES.errors_threshold ? 'warning' : 'critical', detail: `${totalErrors} erros (${errorCount24h || 0} client + ${appLogErrors || 0} backend)`, icon: <AlertTriangle className="h-5 w-5" /> },
    { name: 'Produtos', status: (productStats?.pending ?? 0) === 0 ? 'healthy' : (productStats?.pending ?? 0) <= 5 ? 'warning' : 'critical', detail: `${productStats?.active ?? 0} ativos / ${productStats?.total ?? 0} total — ${productStats?.pending ?? 0} pendentes`, icon: <Database className="h-5 w-5" /> },
  ];
  const overallStatus = checks.some(c => c.status === 'critical') ? 'critical' : checks.some(c => c.status === 'warning') ? 'warning' : checks.every(c => c.status === 'healthy') ? 'healthy' : 'unknown';
  const overall = statusConfig[overallStatus as keyof typeof statusConfig];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {overall.icon}
            <div>
              <p className="text-lg font-bold">Sistema {overall.label}</p>
              <p className="text-sm text-muted-foreground">{checks.filter(c => c.status === 'healthy').length}/{checks.length} serviços operacionais</p>
            </div>
            <Badge className={`ml-auto ${overall.color} text-sm px-3 py-1`}>{overall.label}</Badge>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {checks.map((check) => {
          const cfg = statusConfig[check.status as keyof typeof statusConfig];
          return (
            <Card key={check.name}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">{check.icon}{check.name}</CardTitle>
                  <Badge className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{check.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
