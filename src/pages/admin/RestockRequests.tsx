import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Bell, Mail, MessageCircle, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { storefrontApiRequest } from '@/lib/shopify/client';
import { restockMessage } from '@/lib/restock';
import { formatPhone } from '@/hooks/useStoreContact';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

type Request = Database['public']['Tables']['restock_requests']['Row'];
const PAGE_SIZE = 25;
const labels = { waiting: 'Aguardando reposição', notified: 'Já avisado', cancelled: 'Cancelado' };

export default function RestockRequests() {
  const [status, setStatus] = useState('waiting');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [channels, setChannels] = useState<Record<string, 'whatsapp' | 'email'>>({});
  const client = useQueryClient();
  const requests = useQuery({
    queryKey: ['restock-requests', status, search, page],
    meta: { persist: false },
    gcTime: 0,
    queryFn: async () => {
      let query = supabase.from('restock_requests').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (status !== 'all') query = query.eq('status', status as Request['status']);
      const needle = search.replace(/[^\p{L}\p{N}@.\s+-]/gu, '').trim();
      if (needle) query = query.or(`name.ilike.%${needle}%,email.ilike.%${needle}%,product_title.ilike.%${needle}%,whatsapp.ilike.%${needle}%`);
      const { data, error, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });
  const variantIds = [...new Set((requests.data?.rows ?? []).filter((r) => r.status === 'waiting').map((r) => r.variant_id))].sort();
  const stock = useQuery({
    queryKey: ['restock-live-stock', variantIds],
    queryFn: async () => {
      const response = await storefrontApiRequest<{ nodes: Array<{ id: string; availableForSale: boolean } | null> }>(
        'query RestockAvailability($ids: [ID!]!) { nodes(ids: $ids) { ... on ProductVariant { id availableForSale } } }', { ids: variantIds },
      );
      if (!response?.data?.nodes) throw new Error('Estoque indisponível');
      return new Map(response.data.nodes.filter((n): n is { id: string; availableForSale: boolean } => !!n?.id).map((n) => [n.id, n.availableForSale]));
    },
    enabled: variantIds.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const update = useMutation({
    mutationFn: async ({ request, next }: { request: Request; next: Request['status'] }) => {
      const { data, error } = await supabase.from('restock_requests').update({
        status: next, notified_at: next === 'notified' ? new Date().toISOString() : null,
        notified_via: next === 'notified' ? channels[request.id] ?? 'other' : null,
      }).eq('id', request.id).eq('status', request.status).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('O cadastro foi alterado. Atualize a lista.');
    },
    onSuccess: () => { client.invalidateQueries({ queryKey: ['restock-requests'] }); toast.success('Cadastro atualizado'); },
    onError: (error) => toast.error(error.message || 'Não foi possível atualizar.'),
  });

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Bell className="size-6" /> Avisos de reposição</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Veja quem espera por cada cor e tamanho. Confira o estoque, envie o aviso manualmente e marque o cadastro como avisado.</p></div>
      <Button variant="outline" disabled={requests.isFetching || stock.isFetching} onClick={() => { requests.refetch(); if (variantIds.length) stock.refetch(); }}><RefreshCw className="size-4" /> Atualizar estoque</Button>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar cadastros" placeholder="Nome, produto, email ou WhatsApp" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></div>
      <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}><SelectTrigger className="sm:w-56" aria-label="Filtrar por status"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">Todos os cadastros</SelectItem>{Object.entries(labels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select>
    </div>
    {requests.isLoading ? <Skeleton className="h-64 w-full" /> : requests.isError ? <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border p-6"><p>Não foi possível carregar os cadastros.</p><Button variant="outline" onClick={() => requests.refetch()}>Tentar novamente</Button></div> : !requests.data?.rows.length ? <div className="rounded-lg border border-dashed py-12 text-center"><Bell className="mx-auto mb-3 size-8 text-muted-foreground" /><h2 className="font-semibold">Nenhum cadastro por aqui</h2><p className="mt-1 text-sm text-muted-foreground">Os pedidos de aviso dos produtos esgotados aparecerão nesta lista.</p></div> : <>
      <p className="text-sm text-muted-foreground">{requests.data.count} cadastro(s) encontrado(s)</p>
      <div className="flex flex-col divide-y rounded-lg border">
        {requests.data.rows.map((r) => {
          const available = stock.data?.get(r.variant_id);
          const message = restockMessage(r.name, r.product_title, r.variant_title, r.product_handle);
          return <article key={r.id} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start">
            <div className="flex-1 min-w-0"><a href={`/produto/${r.product_handle}`} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">{r.product_title}</a><p className="mt-1 text-sm">{r.variant_title === 'Default Title' ? 'Opção única' : r.variant_title}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="secondary">{labels[r.status]}</Badge>{r.status === 'waiting' && <Badge variant={available ? 'default' : 'outline'}>{stock.isFetching ? 'Consultando estoque…' : stock.isError ? 'Estoque não verificado' : available === true ? 'Disponível para compra' : available === false ? 'Ainda esgotado' : 'Opção não encontrada'}</Badge>}</div><p className="mt-2 text-xs text-muted-foreground">Pedido em {new Date(r.created_at).toLocaleString('pt-BR')}{r.notified_at ? ` · Avisado em ${new Date(r.notified_at).toLocaleString('pt-BR')}` : ''}</p></div>
            <div className="flex flex-1 min-w-0 flex-col gap-1 text-sm"><p className="font-medium">{r.name}</p><p className="break-all">{r.email}</p><p>{formatPhone(r.whatsapp)}</p></div>
            <div className="flex flex-wrap gap-2 lg:max-w-64">
              {r.status === 'waiting' && <>
                <Button asChild variant="outline" size="sm" disabled={!available}><a aria-disabled={!available} onClick={(e) => { if (!available) { e.preventDefault(); return; } setChannels((p) => ({ ...p, [r.id]: 'whatsapp' })); }} href={available ? `https://wa.me/${r.whatsapp}?text=${encodeURIComponent(message)}` : undefined} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" /> WhatsApp</a></Button>
                <Button asChild variant="outline" size="sm"><a aria-disabled={!available} onClick={(e) => { if (!available) { e.preventDefault(); return; } setChannels((p) => ({ ...p, [r.id]: 'email' })); }} href={available ? `mailto:${r.email}?subject=${encodeURIComponent('Seu favorito voltou à Vanessa Lima Shoes')}&body=${encodeURIComponent(message)}` : undefined}><Mail className="size-4" /> Email</a></Button>
                <Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ request: r, next: 'notified' })}>Já avisei</Button>
                <Button variant="ghost" size="sm" disabled={update.isPending} onClick={() => update.mutate({ request: r, next: 'cancelled' })}>Cancelar</Button>
              </>}
            </div>
          </article>;
        })}
      </div>
      <div className="flex items-center justify-between gap-2"><Button variant="outline" disabled={page === 0 || requests.isFetching} onClick={() => setPage((p) => p - 1)}>Anterior</Button><span className="text-sm">Página {page + 1} de {Math.max(1, Math.ceil(requests.data.count / PAGE_SIZE))}</span><Button variant="outline" disabled={(page + 1) * PAGE_SIZE >= requests.data.count || requests.isFetching} onClick={() => setPage((p) => p + 1)}>Próxima</Button></div>
    </>}
  </div>;
}
