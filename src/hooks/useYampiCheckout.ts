import { useRef, useState } from 'react';
import { CHECKOUT_UNAVAILABLE_MESSAGE, startCheckout } from '@/config/checkout';
import { useShopifyCartStore } from '@/stores/shopifyCartStore';

export function useYampiCheckout(onRedirect?: () => void) {
  const pending = useRef(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (pending.current) return;
    pending.current = true;
    setIsRedirecting(true);
    setCheckoutError(null);
    try {
      const { items } = useShopifyCartStore.getState();
      const url = await startCheckout(items.map((item) => ({
        variantId: item.variantId,
        productId: item.product.id,
        quantity: item.quantity,
        title: item.product.title,
        variantTitle: item.variantTitle,
        price: item.price.amount,
        requiresShipping: true,
      })));
      window.location.assign(url);
      onRedirect?.();
    } catch {
      setCheckoutError(CHECKOUT_UNAVAILABLE_MESSAGE);
    } finally {
      pending.current = false;
      setIsRedirecting(false);
    }
  };

  return { handleCheckout, isRedirecting, checkoutError };
}
