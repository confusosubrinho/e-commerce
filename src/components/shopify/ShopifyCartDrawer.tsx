import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useShopifyCartStore } from '@/stores/shopifyCartStore';
import { formatCurrency } from '@/lib/pricingEngine';

interface Props {
  /** Renderiza o trigger interno (default true). Se false, controle via `open`/`onOpenChange`. */
  withTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ShopifyCartDrawer({ withTrigger = true, open, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  const { items, isLoading, isSyncing, updateQuantity, removeItem, getCheckoutUrl, syncCart } =
    useShopifyCartStore();

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + parseFloat(i.price.amount) * i.quantity, 0);

  useEffect(() => {
    if (isOpen) syncCart();
  }, [isOpen, syncCart]);

  const handleCheckout = () => {
    const url = getCheckoutUrl();
    if (!url) return;
    window.open(url, '_blank');
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {withTrigger && (
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="relative rounded-full border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 min-w-[44px] min-h-[44px]"
            aria-label={
              totalItems > 0
                ? `Carrinho de compras, ${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`
                : 'Abrir carrinho de compras'
            }
          >
            <ShoppingBag className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-secondary text-secondary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {totalItems}
              </span>
            )}
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="w-[85vw] max-w-lg flex flex-col p-0">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle>Carrinho de Compras</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="text-center py-12 px-4">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Seu carrinho está vazio</p>
            <Button className="mt-4" onClick={() => setIsOpen(false)}>
              Continuar comprando
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.variantId} className="flex gap-3 border-b pb-3">
                    {item.product.image ? (
                      <img
                        src={item.product.image.url}
                        alt={item.product.title}
                        className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-1">
                        <div className="min-w-0">
                          <p className="font-medium text-sm line-clamp-1">{item.product.title}</p>
                          {item.selectedOptions.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {item.selectedOptions.map((o) => o.value).join(' · ')}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.variantId)}
                          aria-label={`Remover ${item.product.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center border rounded-lg">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-5 text-center text-xs">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="font-bold text-sm">
                          {formatCurrency(parseFloat(item.price.amount) * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t px-4 py-3 space-y-2 bg-background">
              <div className="flex justify-between text-base font-bold">
                <span>Total:</span>
                <span>{formatCurrency(totalPrice)}</span>
              </div>
              <Button
                onClick={handleCheckout}
                className="w-full"
                size="sm"
                disabled={isLoading || isSyncing || items.length === 0}
              >
                {isLoading || isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Finalizar Compra
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                O pagamento é processado em ambiente seguro Shopify
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
