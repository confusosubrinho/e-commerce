import { useMemo, useState } from 'react';
import { formatPrice } from '@/lib/formatters';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, Copy, PauseCircle, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/auditLogger';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type CouponRow = Record<string, any>;

const emptyForm = {
  code: '',
  name: '',
  status: 'active',
  discount_kind: 'order_discount',
  discount_type: 'percentage',
  discount_value: '',
  min_purchase_amount: '',
  max_purchase_amount: '',
  max_uses: '',
  usage_per_customer: '',
  start_at: '',
  end_at: '',
  campaign_tag: '',
  internal_note: '',
  applicable_states: '',
  applicable_cities: '',
  applicable_zip_prefixes: '',
  applicable_product_ids: '',
  applicable_category_ids: '',
  excluded_product_ids: '',
  excluded_category_ids: '',
  applicable_brand_names: '',
  allow_coupon_stack: false,
  allow_auto_promotions: true,
  is_active: true,
};

export default function Coupons() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRow | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [formData, setFormData] = useState(emptyForm);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ['admin-coupons-v2'],
    queryFn: async () => {
      const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CouponRow[];
    },
  });

  const campaigns = useMemo(() => {
    const tags = Array.from(new Set((coupons || []).map((c) => c.campaign_tag).filter(Boolean)));
    return tags.sort();
  }, [coupons]);

  const filteredCoupons = useMemo(() => {
    return (coupons || []).filter((coupon) => {
      const searchValue = search.trim().toLowerCase();
      if (searchValue && !String(coupon.code || '').toLowerCase().includes(searchValue) && !String(coupon.name || '').toLowerCase().includes(searchValue)) return false;
      if (statusFilter !== 'all' && String(coupon.status || 'active') !== statusFilter) return false;
      if (typeFilter !== 'all' && String(coupon.discount_kind || 'order_discount') !== typeFilter) return false;
      if (campaignFilter !== 'all' && String(coupon.campaign_tag || '') !== campaignFilter) return false;
      return true;
    });
  }, [campaignFilter, coupons, search, statusFilter, typeFilter]);

  const parseCsv = (value: string) => value.split(',').map((part) => part.trim()).filter(Boolean);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: CouponRow = {
        code: data.code.toUpperCase(),
        name: data.name || null,
        status: data.status,
        discount_kind: data.discount_kind,
        discount_type: data.discount_type,
        discount_value: data.discount_kind === 'free_shipping' ? 0 : Number(data.discount_value || 0),
        min_purchase_amount: data.min_purchase_amount ? Number(data.min_purchase_amount) : 0,
        max_purchase_amount: data.max_purchase_amount ? Number(data.max_purchase_amount) : null,
        max_uses: data.max_uses ? Number(data.max_uses) : null,
        usage_per_customer: data.usage_per_customer ? Number(data.usage_per_customer) : null,
        start_at: data.start_at || null,
        end_at: data.end_at || null,
        campaign_tag: data.campaign_tag || null,
        internal_note: data.internal_note || null,
        applicable_states: parseCsv(data.applicable_states).length ? parseCsv(data.applicable_states).map((x) => x.toUpperCase().slice(0, 2)) : null,
        applicable_cities: parseCsv(data.applicable_cities).length ? parseCsv(data.applicable_cities) : null,
        applicable_zip_prefixes: parseCsv(data.applicable_zip_prefixes).length ? parseCsv(data.applicable_zip_prefixes).map((x) => x.replace(/\D/g, '')) : null,
        applicable_product_ids: parseCsv(data.applicable_product_ids).length ? parseCsv(data.applicable_product_ids) : null,
        applicable_category_ids: parseCsv(data.applicable_category_ids).length ? parseCsv(data.applicable_category_ids) : null,
        excluded_product_ids: parseCsv(data.excluded_product_ids).length ? parseCsv(data.excluded_product_ids) : null,
        excluded_category_ids: parseCsv(data.excluded_category_ids).length ? parseCsv(data.excluded_category_ids) : null,
        applicable_brand_names: parseCsv(data.applicable_brand_names).length ? parseCsv(data.applicable_brand_names) : null,
        allow_coupon_stack: data.allow_coupon_stack,
        allow_auto_promotions: data.allow_auto_promotions,
        is_active: data.is_active,
      };

      if (editingCoupon) {
        const { error } = await supabase.from('coupons').update(payload).eq('id', editingCoupon.id);
        if (error) throw error;
        await logAudit({ action: 'update', resourceType: 'coupon', resourceId: editingCoupon.id, resourceName: payload.code });
      } else {
        const { error } = await supabase.from('coupons').insert(payload);
        if (error) throw error;
        await logAudit({ action: 'create', resourceType: 'coupon', resourceName: payload.code });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons-v2'] });
      setIsDialogOpen(false);
      setEditingCoupon(null);
      setFormData(emptyForm);
      toast({ title: 'Cupom salvo com sucesso.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao salvar cupom', description: error?.message || 'Tente novamente.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons-v2'] });
      toast({ title: 'Cupom removido.' });
    },
  });

  const duplicateCoupon = async (coupon: CouponRow) => {
    const copyCode = `${coupon.code}_COPY_${Math.floor(Math.random() * 999)}`;
    const payload = { ...coupon, id: undefined, code: copyCode, uses_count: 0, status: 'draft', is_active: false };
    const { error } = await supabase.from('coupons').insert(payload);
    if (error) {
      toast({ title: 'Erro ao duplicar cupom', description: error.message, variant: 'destructive' });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['admin-coupons-v2'] });
    toast({ title: `Cupom ${copyCode} criado em rascunho.` });
  };

  const togglePause = async (coupon: CouponRow) => {
    const nextStatus = coupon.status === 'paused' ? 'active' : 'paused';
    const { error } = await supabase.from('coupons').update({ status: nextStatus, is_active: nextStatus === 'active' }).eq('id', coupon.id);
    if (error) {
      toast({ title: 'Erro ao alterar status', description: error.message, variant: 'destructive' });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['admin-coupons-v2'] });
  };

  const editCoupon = (coupon: CouponRow) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code || '',
      name: coupon.name || '',
      status: coupon.status || 'active',
      discount_kind: coupon.discount_kind || 'order_discount',
      discount_type: coupon.discount_type || 'percentage',
      discount_value: String(coupon.discount_value || ''),
      min_purchase_amount: String(coupon.min_purchase_amount || ''),
      max_purchase_amount: String(coupon.max_purchase_amount || ''),
      max_uses: String(coupon.max_uses || ''),
      usage_per_customer: String(coupon.usage_per_customer || ''),
      start_at: coupon.start_at ? coupon.start_at.slice(0, 16) : '',
      end_at: coupon.end_at ? coupon.end_at.slice(0, 16) : '',
      campaign_tag: coupon.campaign_tag || '',
      internal_note: coupon.internal_note || '',
      applicable_states: Array.isArray(coupon.applicable_states) ? coupon.applicable_states.join(', ') : '',
      applicable_cities: Array.isArray(coupon.applicable_cities) ? coupon.applicable_cities.join(', ') : '',
      applicable_zip_prefixes: Array.isArray(coupon.applicable_zip_prefixes) ? coupon.applicable_zip_prefixes.join(', ') : '',
      applicable_product_ids: Array.isArray(coupon.applicable_product_ids) ? coupon.applicable_product_ids.join(', ') : '',
      applicable_category_ids: Array.isArray(coupon.applicable_category_ids) ? coupon.applicable_category_ids.join(', ') : '',
      excluded_product_ids: Array.isArray(coupon.excluded_product_ids) ? coupon.excluded_product_ids.join(', ') : '',
      excluded_category_ids: Array.isArray(coupon.excluded_category_ids) ? coupon.excluded_category_ids.join(', ') : '',
      applicable_brand_names: Array.isArray(coupon.applicable_brand_names) ? coupon.applicable_brand_names.join(', ') : '',
      allow_coupon_stack: !!coupon.allow_coupon_stack,
      allow_auto_promotions: coupon.allow_auto_promotions !== false,
      is_active: coupon.is_active !== false,
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cupons (v2)</h1>
          <p className="text-muted-foreground">Sistema avançado com regras de catálogo, região, período e combinação.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo cupom</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingCoupon ? 'Editar cupom' : 'Criar cupom'}</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }}>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Código</Label><Input required value={formData.code} onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))} /></div>
                <div><Label>Nome interno</Label><Input value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Status</Label><Select value={formData.status} onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Rascunho</SelectItem><SelectItem value="active">Ativo</SelectItem><SelectItem value="paused">Pausado</SelectItem></SelectContent></Select></div>
                <div><Label>Tipo</Label><Select value={formData.discount_kind} onValueChange={(v) => setFormData((p) => ({ ...p, discount_kind: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="order_discount">Desconto no pedido</SelectItem><SelectItem value="free_shipping">Frete grátis</SelectItem><SelectItem value="hybrid">Híbrido</SelectItem></SelectContent></Select></div>
                <div><Label>Modalidade</Label><Select value={formData.discount_type} onValueChange={(v) => setFormData((p) => ({ ...p, discount_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Percentual</SelectItem><SelectItem value="fixed">Valor fixo</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div><Label>Valor</Label><Input type="number" step="0.01" value={formData.discount_value} onChange={(e) => setFormData((p) => ({ ...p, discount_value: e.target.value }))} /></div>
                <div><Label>Subtotal mín.</Label><Input type="number" step="0.01" value={formData.min_purchase_amount} onChange={(e) => setFormData((p) => ({ ...p, min_purchase_amount: e.target.value }))} /></div>
                <div><Label>Subtotal máx.</Label><Input type="number" step="0.01" value={formData.max_purchase_amount} onChange={(e) => setFormData((p) => ({ ...p, max_purchase_amount: e.target.value }))} /></div>
                <div><Label>Limite total</Label><Input type="number" value={formData.max_uses} onChange={(e) => setFormData((p) => ({ ...p, max_uses: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Limite por cliente</Label><Input type="number" value={formData.usage_per_customer} onChange={(e) => setFormData((p) => ({ ...p, usage_per_customer: e.target.value }))} /></div>
                <div><Label>Início</Label><Input type="datetime-local" value={formData.start_at} onChange={(e) => setFormData((p) => ({ ...p, start_at: e.target.value }))} /></div>
                <div><Label>Fim</Label><Input type="datetime-local" value={formData.end_at} onChange={(e) => setFormData((p) => ({ ...p, end_at: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Tag / Campanha</Label><Input value={formData.campaign_tag} onChange={(e) => setFormData((p) => ({ ...p, campaign_tag: e.target.value }))} /></div>
                <div><Label>Marcas elegíveis</Label><Input value={formData.applicable_brand_names} onChange={(e) => setFormData((p) => ({ ...p, applicable_brand_names: e.target.value }))} placeholder="nike, adria" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Estados elegíveis (UF)</Label><Input value={formData.applicable_states} onChange={(e) => setFormData((p) => ({ ...p, applicable_states: e.target.value }))} /></div>
                <div><Label>Cidades elegíveis</Label><Input value={formData.applicable_cities} onChange={(e) => setFormData((p) => ({ ...p, applicable_cities: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>CEP prefixos</Label><Input value={formData.applicable_zip_prefixes} onChange={(e) => setFormData((p) => ({ ...p, applicable_zip_prefixes: e.target.value }))} /></div>
                <div><Label>Produtos elegíveis (ids)</Label><Input value={formData.applicable_product_ids} onChange={(e) => setFormData((p) => ({ ...p, applicable_product_ids: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Produtos excluídos (ids)</Label><Input value={formData.excluded_product_ids} onChange={(e) => setFormData((p) => ({ ...p, excluded_product_ids: e.target.value }))} /></div>
                <div><Label>Categorias excluídas (ids)</Label><Input value={formData.excluded_category_ids} onChange={(e) => setFormData((p) => ({ ...p, excluded_category_ids: e.target.value }))} /></div>
              </div>
              <div><Label>Observação interna</Label><Input value={formData.internal_note} onChange={(e) => setFormData((p) => ({ ...p, internal_note: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2"><Switch checked={formData.is_active} onCheckedChange={(v) => setFormData((p) => ({ ...p, is_active: v }))} /><Label>Ativo</Label></div>
                <div className="flex items-center gap-2"><Switch checked={formData.allow_coupon_stack} onCheckedChange={(v) => setFormData((p) => ({ ...p, allow_coupon_stack: v }))} /><Label>Cumulativo com cupom</Label></div>
                <div className="flex items-center gap-2"><Switch checked={formData.allow_auto_promotions} onCheckedChange={(v) => setFormData((p) => ({ ...p, allow_auto_promotions: v }))} /><Label>Cumulativo com promoções</Label></div>
              </div>
              <div className="p-3 rounded-md bg-muted text-sm">Prévia: <strong>{formData.code || 'SEM-CODIGO'}</strong> • {formData.discount_kind === 'free_shipping' ? 'Frete grátis' : formData.discount_type === 'percentage' ? `${formData.discount_value || 0}%` : formatPrice(Number(formData.discount_value || 0))} • min {formatPrice(Number(formData.min_purchase_amount || 0))}</div>
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : 'Salvar'}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Input placeholder="Buscar por código/nome" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos status</SelectItem><SelectItem value="active">Ativo</SelectItem><SelectItem value="paused">Pausado</SelectItem><SelectItem value="draft">Rascunho</SelectItem><SelectItem value="expired">Expirado</SelectItem><SelectItem value="exhausted">Esgotado</SelectItem></SelectContent></Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos tipos</SelectItem><SelectItem value="order_discount">Desconto</SelectItem><SelectItem value="free_shipping">Frete grátis</SelectItem><SelectItem value="hybrid">Híbrido</SelectItem></SelectContent></Select>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}><SelectTrigger><SelectValue placeholder="Campanha" /></SelectTrigger><SelectContent><SelectItem value="all">Todas campanhas</SelectItem>{campaigns.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}</SelectContent></Select>
      </div>

      <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead><TableHead>Campanha</TableHead><TableHead>Benefício</TableHead><TableHead>Regras</TableHead><TableHead>Usos</TableHead><TableHead>Status</TableHead><TableHead className="w-[180px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7}>Carregando...</TableCell></TableRow> : filteredCoupons.length === 0 ? <TableRow><TableCell colSpan={7}>Nenhum cupom encontrado.</TableCell></TableRow> : filteredCoupons.map((coupon) => (
              <TableRow key={coupon.id}>
                <TableCell><div className="font-mono font-semibold">{coupon.code}</div><div className="text-xs text-muted-foreground">{coupon.name || '-'}</div></TableCell>
                <TableCell>{coupon.campaign_tag ? <Badge variant="outline">{coupon.campaign_tag}</Badge> : '-'}</TableCell>
                <TableCell>{coupon.discount_kind === 'free_shipping' ? 'Frete grátis' : coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : formatPrice(Number(coupon.discount_value || 0))}</TableCell>
                <TableCell className="text-xs text-muted-foreground">min {formatPrice(Number(coupon.min_purchase_amount || 0))} / máx {coupon.max_purchase_amount ? formatPrice(Number(coupon.max_purchase_amount)) : '∞'}</TableCell>
                <TableCell>{coupon.uses_count || 0} / {coupon.max_uses || '∞'}</TableCell>
                <TableCell><Badge variant={coupon.status === 'active' ? 'default' : 'secondary'}>{coupon.status || 'active'}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => editCoupon(coupon)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => duplicateCoupon(coupon)}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => togglePause(coupon)}>{coupon.status === 'paused' ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}</Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setCouponToDelete(coupon.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!couponToDelete} onOpenChange={(open) => !open && setCouponToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir cupom?</AlertDialogTitle><AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (couponToDelete) { deleteMutation.mutate(couponToDelete); setCouponToDelete(null); } }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
