import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageCircle, Mail, Search, ShoppingCart, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AbandonedCart {
  id: string;
  session_id: string;
  email: string | null;
  phone: string | null;
  customer_name: string | null;
  cart_data: any[];
  subtotal: number;
  utm_source: string | null;
  utm_medium: string | null;
  traffic_type?: string;
  recovered: boolean;
  contacted_via: string | null;
  contacted_at: string | null;
  created_at: string;
}

export default function AbandonedCarts() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');

  const { data: carts, isLoading, refetch } = useQuery({
    queryKey: ['abandoned-carts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('abandoned_carts' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as AbandonedCart[];
    },
  });

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  const handleWhatsApp = async (cart: AbandonedCart) => {
    if (!cart.phone) {
      toast({ title: 'Telefone não disponível', variant: 'destructive' });
      return;
    }
    const phone = cart.phone.replace(/\D/g, '');
    const items = (cart.cart_data || []).map((i: any) => i.product?.name || 'Produto').join(', ');
    const msg = `Olá${cart.customer_name ? ' ' + cart.customer_name : ''}! Notamos que você deixou itens no carrinho: ${items}. Total: ${formatPrice(cart.subtotal)}. Podemos ajudar a finalizar sua compra?`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');

    await supabase.from('abandoned_carts' as any).update({
      contacted_via: 'whatsapp',
      contacted_at: new Date().toISOString(),
    } as any).eq('id', cart.id);
    refetch();
  };

  const handleEmail = async (cart: AbandonedCart) => {
    if (!cart.email) {
      toast({ title: 'Email não disponível', variant: 'destructive' });
      return;
    }
    const subject = 'Você esqueceu algo no carrinho! 🛒';
    window.open(`mailto:${cart.email}?subject=${encodeURIComponent(subject)}`, '_blank');

    await supabase.from('abandoned_carts' as any).update({
      contacted_via: 'email',
      contacted_at: new Date().toISOString(),
    } as any).eq('id', cart.id);
    refetch();
  };

  const markRecovered = async (id: string) => {
    await supabase.from('abandoned_carts' as any).update({
      recovered: true,
      recovered_at: new Date().toISOString(),
    } as any).eq('id', id);
    refetch();
    toast({ title: 'Carrinho marcado como recuperado!' });
  };

  const filtered = (carts || []).filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.email?.toLowerCase().includes(s) ||
      c.customer_name?.toLowerCase().includes(s) ||
      c.phone?.includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Carrinhos Abandonados
          </h1>
          <p className="text-muted-foreground">Recupere vendas entrando em contato com clientes</p>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline">{filtered.length} carrinhos</Badge>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum carrinho abandonado encontrado</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(cart => (
                <TableRow key={cart.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{cart.customer_name || 'Anônimo'}</p>
                      {cart.email && <p className="text-xs text-muted-foreground">{cart.email}</p>}
                      {cart.phone && <p className="text-xs text-muted-foreground">{cart.phone}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{(cart.cart_data || []).length} itens</span>
                  </TableCell>
                  <TableCell className="font-medium">{formatPrice(cart.subtotal)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {cart.utm_source || 'direto'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(cart.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {cart.recovered ? (
                      <Badge className="bg-primary/10 text-primary border-primary/20">Recuperado</Badge>
                    ) : cart.contacted_via ? (
                      <Badge variant="outline">Contatado via {cart.contacted_via}</Badge>
                    ) : (
                      <Badge variant="secondary">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleWhatsApp(cart)} title="WhatsApp" disabled={!cart.phone}>
                        <MessageCircle className="h-4 w-4 text-[#25D366]" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleEmail(cart)} title="Email" disabled={!cart.email}>
                        <Mail className="h-4 w-4" />
                      </Button>
                      {!cart.recovered && (
                        <Button size="icon" variant="ghost" onClick={() => markRecovered(cart.id)} title="Marcar como recuperado">
                          <CheckCircle className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
