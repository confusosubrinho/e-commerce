import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  addLineToShopifyCart,
  createShopifyCart,
  removeLineFromShopifyCart,
  updateShopifyCartLine,
} from '@/lib/shopify/cart';
import { storefrontApiRequest } from '@/lib/shopify/client';
import { CART_QUERY } from '@/lib/shopify/queries';
import type { ShopifyMoney, ShopifyProductNode } from '@/lib/shopify/types';

export interface ShopifyCartItem {
  lineId: string | null;
  /** Snapshot mínimo do produto para renderizar no drawer/cart sem nova chamada. */
  product: Pick<ShopifyProductNode, 'id' | 'title' | 'handle'> & {
    image?: { url: string; altText: string | null } | null;
  };
  variantId: string;
  variantTitle: string;
  price: ShopifyMoney;
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
}

interface ShopifyCartStore {
  items: ShopifyCartItem[];
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  addItem: (item: Omit<ShopifyCartItem, 'lineId'>) => Promise<void>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clearCart: () => void;
  syncCart: () => Promise<void>;
  getCheckoutUrl: () => string | null;
  totalItems: () => number;
  subtotal: () => number;
}

export const useShopifyCartStore = create<ShopifyCartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isSyncing: false,

      addItem: async (item) => {
        const { items, cartId, clearCart } = get();
        const existing = items.find((i) => i.variantId === item.variantId);
        set({ isLoading: true });
        try {
          if (!cartId) {
            const result = await createShopifyCart({
              variantId: item.variantId,
              quantity: item.quantity,
            });
            if (result) {
              set({
                cartId: result.cartId,
                checkoutUrl: result.checkoutUrl,
                items: [{ ...item, lineId: result.lineId }],
              });
            }
          } else if (existing) {
            const newQty = existing.quantity + item.quantity;
            if (!existing.lineId) return;
            const result = await updateShopifyCartLine(cartId, existing.lineId, newQty);
            if (result.success) {
              set({
                items: get().items.map((i) =>
                  i.variantId === item.variantId ? { ...i, quantity: newQty } : i
                ),
              });
            } else if (result.cartNotFound) {
              clearCart();
            }
          } else {
            const result = await addLineToShopifyCart(cartId, {
              variantId: item.variantId,
              quantity: item.quantity,
            });
            if (result.success) {
              set({
                items: [...get().items, { ...item, lineId: result.lineId ?? null }],
              });
            } else if (result.cartNotFound) {
              clearCart();
            }
          }
        } catch (err) {
          console.error('Shopify cart addItem failed', err);
        } finally {
          set({ isLoading: false });
        }
      },

      updateQuantity: async (variantId, quantity) => {
        if (quantity <= 0) {
          await get().removeItem(variantId);
          return;
        }
        const { items, cartId, clearCart } = get();
        const item = items.find((i) => i.variantId === variantId);
        if (!item?.lineId || !cartId) return;
        set({ isLoading: true });
        try {
          const result = await updateShopifyCartLine(cartId, item.lineId, quantity);
          if (result.success) {
            set({
              items: get().items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
            });
          } else if (result.cartNotFound) {
            clearCart();
          }
        } finally {
          set({ isLoading: false });
        }
      },

      removeItem: async (variantId) => {
        const { items, cartId, clearCart } = get();
        const item = items.find((i) => i.variantId === variantId);
        if (!item?.lineId || !cartId) return;
        set({ isLoading: true });
        try {
          const result = await removeLineFromShopifyCart(cartId, item.lineId);
          if (result.success) {
            const remaining = get().items.filter((i) => i.variantId !== variantId);
            if (remaining.length === 0) clearCart();
            else set({ items: remaining });
          } else if (result.cartNotFound) {
            clearCart();
          }
        } finally {
          set({ isLoading: false });
        }
      },

      clearCart: () => set({ items: [], cartId: null, checkoutUrl: null }),
      getCheckoutUrl: () => get().checkoutUrl,
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: () =>
        get().items.reduce((sum, i) => sum + parseFloat(i.price.amount) * i.quantity, 0),

      syncCart: async () => {
        const { cartId, isSyncing, clearCart } = get();
        if (!cartId || isSyncing) return;
        set({ isSyncing: true });
        try {
          const data = await storefrontApiRequest<{
            cart: { id: string; totalQuantity: number } | null;
          }>(CART_QUERY, { id: cartId });
          if (!data) return;
          const cart = data.data?.cart;
          if (!cart || cart.totalQuantity === 0) clearCart();
        } catch (err) {
          console.error('Shopify cart sync failed', err);
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: 'shopify-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        cartId: state.cartId,
        checkoutUrl: state.checkoutUrl,
      }),
    }
  )
);
