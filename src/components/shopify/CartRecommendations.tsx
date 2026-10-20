import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, Plus, Truck } from 'lucide-react';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';
import { useStoreSettingsPublic } from '@/hooks/useStoreContact';
import { useShopifyCartStore } from '@/stores/shopifyCartStore';
import { freeShippingProgress, rankCartSuggestions } from '@/lib/cartSuggestions';
import { formatCurrency } from '@/lib/pricingEngine';
import { resolveImageUrl } from '@/lib/imageUrl';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ShopifyProductNode } from '@/lib/shopify/types';

function SuggestedProduct({ product, price, onNavigate }: { product: ShopifyProductNode; price: number; onNavigate: () => void }) {
  const variants = product.variants.edges.map((e) => e.node).filter((v) => v.availableForSale && v.price.currencyCode === 'BRL');
  const [choice, setChoice] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const selected = variants.length === 1 ? variants[0] : variants.find((v) => v.id === choice);
  const image = selected?.image ?? product.images.edges[0]?.node;
  const addItem = useShopifyCartStore((s) => s.addItem);
  const cartBusy = useShopifyCartStore((s) => s.isLoading || s.isSyncing);

  const add = async () => {
    if (!selected || adding || cartBusy) return;
    setAdding(true);
    setError('');
    const previous = useShopifyCartStore.getState().items.find((i) => i.variantId === selected.id)?.quantity ?? 0;
    try {
      await addItem({
        product: { id: product.id, title: product.title, handle: product.handle, image },
        variantId: selected.id, variantTitle: selected.title, price: selected.price, quantity: 1,
        selectedOptions: selected.selectedOptions,
      });
      const after = useShopifyCartStore.getState().items.find((i) => i.variantId === selected.id)?.quantity ?? 0;
      if (after <= previous) setError('Não foi possível adicionar. Tente novamente.');
    } catch {
      setError('Não foi possível adicionar. Tente novamente.');
    } finally { setAdding(false); }
  };

  return <article className="flex gap-3 py-3">
    <Link to={`/produto/${product.handle}`} onClick={onNavigate} className="shrink-0">
      <img src={resolveImageUrl(image?.url, { width: 160 })} alt={product.title} loading="lazy" className="size-20 rounded-md object-cover bg-muted" width={80} height={80} />
    </Link>
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Link to={`/produto/${product.handle}`} onClick={onNavigate} className="text-sm font-medium leading-snug hover:underline">{product.title}</Link>
      <p className="text-sm font-semibold">{selected ? formatCurrency(Number(selected.price.amount)) : `A partir de ${formatCurrency(price)}`}</p>
      {variants.length > 1 && <Select value={choice} onValueChange={setChoice}>
        <SelectTrigger className="h-10 text-xs" aria-label={`Escolher opção de ${product.title}`}><SelectValue placeholder="Escolha cor / tamanho" /></SelectTrigger>
        <SelectContent><SelectGroup>{variants.map((v) => <SelectItem key={v.id} value={v.id}>{v.title} · {formatCurrency(Number(v.price.amount))}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>}
      <Button variant="outline" size="sm" onClick={add} disabled={!selected || adding || cartBusy}>
        {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Adicionar
      </Button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  </article>;
}

export function CartRecommendations({ subtotal, active, onNavigate }: { subtotal: number; active: boolean; onNavigate: () => void }) {
  const { data: settings } = useStoreSettingsPublic();
  const items = useShopifyCartStore((s) => s.items);
  const progress = freeShippingProgress(subtotal, settings?.free_shipping_threshold);
  const { data: products, isLoading } = useShopifyProducts({ first: 100, query: 'available_for_sale:true', sortKey: 'PRICE', enabled: active && !!progress && !progress.reached });
  if (!progress) return null;
  const suggestions = rankCartSuggestions((products ?? []).map((p) => p.node), items.map((i) => i.product.id), progress.remaining);
  return <div className="flex flex-col gap-4 pb-2">
    <div className="flex flex-col gap-2 rounded-lg bg-primary/5 p-3">
      <p className="flex items-center gap-2 text-sm font-medium" aria-live="polite" aria-atomic="true">
        {progress.reached ? <Check className="size-4 shrink-0" /> : <Truck className="size-4 shrink-0" />}
        <span>{progress.reached ? 'Você atingiu a meta de frete grátis!' : <>Faltam <strong>{formatCurrency(progress.remaining)}</strong> para o frete grátis</>}</span>
      </p>
      <Progress value={progress.percent} className="h-2" aria-label="Progresso para o frete grátis" aria-valuenow={Math.round(progress.percent)} />
      <p className="text-xs text-muted-foreground">Condições de entrega confirmadas no checkout.</p>
    </div>
    {!progress.reached && (isLoading || suggestions.length > 0) && <section aria-labelledby="cart-suggestions-title">
      <h3 id="cart-suggestions-title" className="text-sm font-semibold">Complete seu pedido</h3>
      <p className="mt-1 text-xs text-muted-foreground">Combine com suas escolhas e chegue ao frete grátis.</p>
      {isLoading ? <Skeleton className="mt-3 h-24 w-full" /> : <div className="divide-y">{suggestions.map(({ product, price }) => <SuggestedProduct key={product.id} product={product} price={price} onNavigate={onNavigate} />)}</div>}
    </section>}
  </div>;
}
