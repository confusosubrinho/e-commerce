import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatPrice } from '@/lib/formatters';
import { AlertTriangle, RefreshCw, Search, ChevronDown, ChevronUp, ExternalLink, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface InconsistentOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string | null;
  total_amount: number;
  provider: string | null;
  customer_email: string | null;
  created_at: string;
  checkout_session_id: string | null;
  external_reference: string | null;
}

interface CheckoutSessionDetail {
  id: string;
  total_amount: number;
  discount_amount: number;
  shipping_amount: number;
  subtotal: number;
  coupon_code: string | null;
  status: string;
  payment_inconsistency_reason: string | null;
  created_at: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
  }>;
}

interface OrderEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

function InconsistencyRow({ order }: { order: InconsistentOrder }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: session } = useQuery({
    queryKey: ['checkout-session', order.checkout_session_id],
    queryFn: async () => {
      if (!order.checkout_session_id) return null;
      const { data } = await supabase
        .from('checkout_sessions')
        .select('*')
        .eq('id', order.checkout_session_id)
        .maybeSingle();
      return data as CheckoutSessionDetail | null;
    },
    enabled: expanded && !!order.checkout_session_id,
  });

  const { data: events } = useQuery({
    queryKey: ['order-events-inconsistency', order.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('order_events')
        .select('id, event_type, payload, created_at')
        .eq('order_id', order.id)
        .eq('event_type', 'payment_inconsistency_detected')
        .order('created_at', { ascending: false });
      return (data ?? []) as OrderEvent[];
    },
    enabled: expanded,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: 'approved', status: 'processing' })
        .eq('id', order.id);
      if (error) throw error;

      if (order.checkout_session_id) {
        await supabase
          .from('checkout_sessions')
          .update({ status: 'paid' })
          .eq('id', order.checkout_session_id);
      }
    },
    onSuccess: () => {
      toast({ title: 'Pedido aprovado manualmente', description: `Pedido ${order.order_number} marcado como processando.` });
      queryClient.invalidateQueries({ queryKey: ['payment-inconsistencies'] });
    },
    onError: (e: Error) => {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    },
  });

  const paidAmount = events?.[0]?.payload?.paid_total as number | undefined;
  const expectedAmount = session?.total_amount ?? null;
  const diff = paidAmount != null && expectedAmount != null
    ? Math.abs(paidAmount - expectedAmount)
    : null;

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded((p) => !p)}
      >
        <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground">
            {format(new Date(order.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
          </span>
        </TableCell>
        <TableCell>
          <span className="text-sm truncate max-w-[160px] block">{order.customer_email ?? '—'}</span>
        </TableCell>
        <TableCell className="text-right font-semibold">{formatPrice(order.total_amount)}</TableCell>
        <TableCell className="text-right text-destructive font-semibold">
          {paidAmount != null ? formatPrice(paidAmount) : '—'}
        </TableCell>
        <TableCell className="text-right">
          {diff != null ? (
            <span className={cn('font-semibold', diff > 1 ? 'text-destructive' : 'text-orange-500')}>
              {formatPrice(diff)}
            </span>
          ) : '—'}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-orange-600 border-orange-400 bg-orange-50">
            inconsistente
          </Badge>
        </TableCell>
        <TableCell>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30 p-4">
            <div className="space-y-4">
              {/* Sessão congelada */}
              {session && (
                <div className="rounded-md border p-3 bg-white space-y-2">
                  <p className="text-sm font-semibold text-foreground">Sessão congelada (fonte de verdade do backend)</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Subtotal:</span> {formatPrice(session.subtotal)}</div>
                    <div><span className="text-muted-foreground">Desconto:</span> {formatPrice(session.discount_amount)}</div>
                    <div><span className="text-muted-foreground">Frete:</span> {formatPrice(session.shipping_amount)}</div>
                    <div><span className="text-muted-foreground">Total esperado:</span> <strong>{formatPrice(session.total_amount)}</strong></div>
                  </div>
                  {session.coupon_code && (
                    <p className="text-sm">Cupom: <code className="bg-muted px-1 rounded">{session.coupon_code}</code></p>
                  )}
                  {session.payment_inconsistency_reason && (
                    <p className="text-sm text-destructive">
                      Motivo: <code className="bg-muted px-1 rounded text-xs">{session.payment_inconsistency_reason}</code>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Session ID: {session.id}</p>
                </div>
              )}

              {/* Itens do evento de inconsistência */}
              {events && events.length > 0 && (
                <div className="rounded-md border p-3 bg-white space-y-1">
                  <p className="text-sm font-semibold">Detalhes do evento</p>
                  {events.map((ev) => (
                    <div key={ev.id} className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                      <p>esperado: {formatPrice(ev.payload.expected_total as number)}</p>
                      <p>pago: {formatPrice(ev.payload.paid_total as number)}</p>
                      <p>diferença: {formatPrice(ev.payload.difference_brl as number)}</p>
                      <p>yampi_order_id: {String(ev.payload.yampi_order_id ?? '—')}</p>
                      <p>{format(new Date(ev.created_at), 'dd/MM/yy HH:mm:ss', { locale: ptBR })}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Links externos */}
              <div className="flex flex-wrap gap-2 items-center">
                {order.external_reference && (
                  <a
                    href={`https://admin.yampi.com.br/pedidos/${order.external_reference}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver na Yampi
                  </a>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-700 border-green-400 hover:bg-green-50 ml-auto"
                  onClick={(e) => { e.stopPropagation(); approveMutation.mutate(); }}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Aprovar manualmente
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function PaymentInconsistencies() {
  const [search, setSearch] = useState('');

  const { data: orders, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['payment-inconsistencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, payment_status, total_amount, provider, customer_email, created_at, checkout_session_id, external_reference')
        .eq('payment_status', 'inconsistent')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as InconsistentOrder[];
    },
    refetchInterval: 60_000,
  });

  const filtered = (orders ?? []).filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(s) ||
      o.customer_email?.toLowerCase().includes(s) ||
      o.checkout_session_id?.toLowerCase().includes(s) ||
      o.external_reference?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 text-orange-500 mt-0.5 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold">Inconsistências de Pagamento</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pedidos Yampi onde o valor cobrado diverge do valor esperado pela sessão de checkout.
            Cada caso requer revisão manual antes de ser aprovado.
          </p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de inconsistências</CardDescription>
            <CardTitle className="text-3xl text-orange-600">{orders?.length ?? '—'}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Pedidos aguardando revisão manual
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Valor total em risco</CardDescription>
            <CardTitle className="text-3xl">
              {orders ? formatPrice(orders.reduce((s, o) => s + o.total_amount, 0)) : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Soma dos totais esperados
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>O que fazer</CardDescription>
            <CardTitle className="flex items-center gap-1 text-base">
              <Clock className="h-4 w-4" /> Revisão manual
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Verifique o valor pago na Yampi antes de aprovar
          </CardContent>
        </Card>
      </div>

      {/* Filtro e ação */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedido, e-mail, session..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </Button>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
          <p className="font-semibold">Nenhuma inconsistência encontrada</p>
          <p className="text-sm text-muted-foreground">
            {search ? 'Tente outro termo de busca.' : 'Todos os pagamentos Yampi estão consistentes.'}
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Pago (Yampi)</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => (
                <InconsistencyRow key={order.id} order={order} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
