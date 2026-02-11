import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/types/database';

export interface HomeSection {
  id: string;
  title: string;
  subtitle: string | null;
  section_type: 'carousel' | 'grid';
  source_type: 'category' | 'featured' | 'sale' | 'new' | 'manual';
  category_id: string | null;
  product_ids: string[];
  max_items: number;
  display_order: number;
  is_active: boolean;
  show_view_all: boolean;
  view_all_link: string | null;
  dark_bg: boolean;
  card_bg: boolean;
}

export function useHomeSections() {
  return useQuery({
    queryKey: ['home-sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('home_sections' as any)
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data as unknown as HomeSection[]) || [];
    },
  });
}

export function useAdminHomeSections() {
  return useQuery({
    queryKey: ['admin-home-sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('home_sections' as any)
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data as unknown as HomeSection[]) || [];
    },
  });
}

export function useSectionProducts(section: HomeSection) {
  return useQuery({
    queryKey: ['section-products', section.id, section.source_type, section.category_id, section.product_ids],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`*, category:categories(*), images:product_images(*), variants:product_variants(*)`)
        .eq('is_active', true);

      switch (section.source_type) {
        case 'category':
          if (section.category_id) {
            // Include child categories
            const { data: children } = await supabase
              .from('categories')
              .select('id')
              .eq('parent_category_id', section.category_id);
            const ids = [section.category_id, ...(children?.map(c => c.id) || [])];
            query = query.in('category_id', ids);
          }
          break;
        case 'featured':
          query = query.eq('is_featured', true);
          break;
        case 'new':
          query = query.eq('is_new', true);
          break;
        case 'sale':
          query = query.not('sale_price', 'is', null);
          break;
        case 'manual':
          if (section.product_ids?.length > 0) {
            query = query.in('id', section.product_ids);
          } else {
            return [];
          }
          break;
      }

      query = query.order('created_at', { ascending: false }).limit(section.max_items || 10);
      const { data, error } = await query;
      if (error) throw error;

      let products = (data as Product[]) || [];

      // Filter products with stock
      products = products.filter(p => {
        const variants = (p as any).variants;
        if (!variants || variants.length === 0) return true;
        return variants.some((v: any) => v.stock_quantity > 0 && v.is_active !== false);
      });

      // For sale, filter where sale_price < base_price
      if (section.source_type === 'sale') {
        products = products.filter(p => p.sale_price && p.sale_price < p.base_price);
      }

      // For manual, preserve the order from product_ids
      if (section.source_type === 'manual' && section.product_ids?.length > 0) {
        const idOrder = section.product_ids;
        products.sort((a, b) => idOrder.indexOf(a.id) - idOrder.indexOf(b.id));
      }

      return products;
    },
    enabled: !!section,
  });
}
