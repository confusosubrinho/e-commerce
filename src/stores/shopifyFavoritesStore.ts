import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavoritesState {
  handles: string[];
  toggle: (handle: string) => void;
}

/** Favoritos da vitrine Shopify, salvos neste navegador. */
export const useShopifyFavoritesStore = create<FavoritesState>()(
  persist(
    (set) => ({
      handles: [],
      toggle: (handle) => set((state) => ({
        handles: state.handles.includes(handle)
          ? state.handles.filter((item) => item !== handle)
          : [...state.handles, handle],
      })),
    }),
    { name: 'shopify-favorites', version: 1 },
  ),
);
