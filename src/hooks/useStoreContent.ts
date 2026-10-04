import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Banner, StoreSettings } from '@/types/database';

  export function useBanners() {
    return useQuery({
      queryKey: ['banners'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('banners')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (error) throw error;
        return data as Banner[];
      },
      staleTime: 1000 * 60 * 2,
      refetchOnWindowFocus: true,
    });
  }

  export function useStoreSettings() {
    return useQuery({
      // Keep "store-settings" prefix for broad invalidations,
      // but avoid cache collision with admin private query ['store-settings'].
      queryKey: ['store-settings', 'public'],
      staleTime: 1000 * 60 * 10,
      refetchOnMount: false,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('store_settings_public')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return data as StoreSettings | null;
      },
    });
  }
