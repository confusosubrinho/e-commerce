import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { restockContactSchema } from '@/lib/restock';
import type { ShopifyProductNode, ShopifyVariant } from '@/lib/shopify/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export function RestockRequestDialog({ product, variant, open: controlledOpen, onOpenChange }: { product: ShopifyProductNode; variant: ShopifyVariant; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (next: boolean) => { setLocalOpen(next); onOpenChange?.(next); };
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({ name: '', email: '', whatsapp: '', consent: false, website: '' });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    const parsed = restockContactSchema.safeParse(fields);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSending(true);
    setError('');
    try {
      const { error: failure } = await supabase.rpc('submit_restock_request', { p_data: {
        ...parsed.data, website: fields.website,
        product_id: product.id, variant_id: variant.id, product_handle: product.handle,
        product_title: product.title, variant_title: variant.title,
      } });
      if (failure) throw failure;
      setSuccess(true);
      setFields({ name: '', email: '', whatsapp: '', consent: false, website: '' });
    } catch {
      setError('Não foi possível salvar seu pedido de aviso. Tente novamente em instantes.');
    } finally { setSending(false); }
  };

  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setSuccess(false); setError(''); } }}>
    <DialogTrigger asChild><Button variant="outline" size="lg" className="w-full"><Bell className="size-4" /> Avise-me quando chegar</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{success ? 'Pedido de aviso registrado' : 'Seu próximo favorito pode voltar'}</DialogTitle>
        <DialogDescription>{product.title}{variant.title === 'Default Title' ? '' : ` · ${variant.title}`}</DialogDescription>
      </DialogHeader>
      {success ? <div className="flex flex-col gap-4">
        <Check className="size-8 text-primary" />
        <p className="text-sm">Vamos entrar em contato quando esta opção voltar ao estoque. O cadastro não reserva o produto.</p>
        <Button onClick={() => setOpen(false)}>Entendi</Button>
      </div> : <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Deixe seus dados para nossa equipe avisar você sobre a reposição desta cor e tamanho.</p>
        <div className="flex flex-col gap-2"><Label htmlFor="restock-name">Nome</Label><Input id="restock-name" autoComplete="name" required maxLength={120} value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="restock-whatsapp">WhatsApp com DDD</Label><Input id="restock-whatsapp" type="tel" autoComplete="tel" placeholder="(42) 99999-9999" required maxLength={22} value={fields.whatsapp} onChange={(e) => setFields({ ...fields, whatsapp: e.target.value })} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="restock-email">Email</Label><Input id="restock-email" type="email" autoComplete="email" required maxLength={320} value={fields.email} onChange={(e) => setFields({ ...fields, email: e.target.value })} /></div>
        <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" value={fields.website} onChange={(e) => setFields({ ...fields, website: e.target.value })} /></label></div>
        <div className="flex items-start gap-2">
          <Checkbox id="restock-consent" checked={fields.consent} onCheckedChange={(value) => setFields({ ...fields, consent: value === true })} />
          <Label htmlFor="restock-consent" className="text-xs font-normal leading-relaxed">Quero receber o aviso de reposição por WhatsApp ou email. Meus dados serão usados para esse contato, conforme a <Link to="/politica-privacidade" target="_blank" className="underline">Política de Privacidade</Link>.</Label>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={sending}>{sending ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />} {sending ? 'Salvando…' : 'Quero receber o aviso'}</Button>
      </form>}
    </DialogContent>
  </Dialog>;
}
