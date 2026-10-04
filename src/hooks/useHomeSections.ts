import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HomeSection {
  id: string;
  title: string;
  subtitle: string | null;
  section_type: 'carousel' | 'grid';
  source_type: 'category' | 'featured' | 'sale' | 'new' | 'manual' | 'shopify_collection' | 'shopify_manual';
  category_id: string | null;
  product_ids: string[];
  max_items: number;
  display_order: number;
  is_active: boolean;
  show_view_all: boolean;
  view_all_link: string | null;
  dark_bg: boolean;
  card_bg: boolean;
  sort_order: string;
  shopify_collection_handle?: string | null;
  shopify_product_handles?: string[] | null;
}

const AUTO_LINKS: Record<string, string> = {
  featured: '/mais-vendidos',
  new: '/novidades',
  sale: '/promocoes',
};

export function getViewAllLink(section: HomeSection): string | undefined {
  if (!section.show_view_all) return undefined;
  if (section.view_all_link) return section.view_all_link;
  return AUTO_LINKS[section.source_type];
}

export function useHomeSections() {
  return useQuery({
    queryKey: ['home-sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('home_sections')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data as unknown as HomeSection[]) || [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useAdminHomeSections() {
  return useQuery({
    queryKey: ['admin-home-sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('home_sections')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data as unknown as HomeSection[]) || [];
    },
  });
}
