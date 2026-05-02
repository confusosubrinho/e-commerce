import { Link } from 'react-router-dom';
import { StoreLayout } from '@/components/store/StoreLayout';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useShopifyCartStore } from '@/stores/shopifyCartStore';
import { formatCurrency } from '@/lib/pricingEngine';

const Cart = () => {
  const { items, isLoading, isSyncing, updateQuantity, removeItem, getCheckoutUrl } =
    useShopifyCartStore();
  const totalPrice = items.reduce((sum, i) => sum + parseFloat(i.price.amount) * i.quantity, 0);

  const handleCheckout = () => {
    const url = getCheckoutUrl();
    if (!url) return;
    window.open(url, '_blank');
  };

  return (
    <StoreLayout>
      <div className="container-custom py-8 max-w-4xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Meu carrinho</h1>

        {items.length === 0 ? (
          <div className="text-center py-16 border rounded-lg bg-muted/30">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg">Seu carrinho está vazio</p>
            <Button asChild className="mt-4">
              <Link to="/">Continuar comprando</Link>
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-3">
              {items.map((item) => (
                <div
                  key={item.variantId}
                  className="flex gap-4 p-3 border rounded-lg bg-background"
                >
                  {item.product.image ? (
                    <img
                      src={item.product.image.url}
                      alt={item.product.title}
                      className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-muted flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/product/${item.product.handle}`}
                      className="font-medium hover:text-primary line-clamp-2"
                    >
                      {item.product.title}
                    </Link>
                    {item.selectedOptions.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.selectedOptions.map((o) => o.value).join(' · ')}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border rounded-lg">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="font-bold">
                        {formatCurrency(parseFloat(item.price.amount) * item.quantity)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive self-start"
                    onClick={() => removeItem(item.variantId)}
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <aside className="space-y-3 p-4 border rounded-lg bg-background h-fit sticky top-24">
              <h2 className="font-semibold">Resumo</h2>
              <div className="flex justify-between text-base font-bold pt-2 border-t">
                <span>Total</span>
                <span>{formatCurrency(totalPrice)}</span>
              </div>
              <Button
                onClick={handleCheckout}
                className="w-full"
                disabled={isLoading || isSyncing || items.length === 0}
              >
                {isLoading || isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" /> Finalizar Compra
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Frete e cupons são calculados no checkout seguro Shopify.
              </p>
            </aside>
          </div>
        )}
      </div>
    </StoreLayout>
  );
};

export default Cart;
