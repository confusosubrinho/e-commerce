import { useEffect } from 'react';
import { useShopifyCartStore } from '@/stores/shopifyCartStore';

/**
 * Sincroniza o carrinho local com a Shopify ao montar e ao voltar para a aba.
 * Limpa o carrinho local automaticamente quando o cart na Shopify expirou ou
 * já foi convertido em pedido (totalQuantity = 0).
 */
export function useShopifyCartSync() {
  const syncCart = useShopifyCartStore((s) => s.syncCart);

  useEffect(() => {
    syncCart();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncCart();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [syncCart]);
}
