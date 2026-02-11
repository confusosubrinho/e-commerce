
CREATE TABLE public.home_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  section_type TEXT NOT NULL DEFAULT 'carousel',
  source_type TEXT NOT NULL DEFAULT 'category',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  product_ids UUID[] DEFAULT '{}',
  max_items INTEGER DEFAULT 10,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  show_view_all BOOLEAN DEFAULT true,
  view_all_link TEXT,
  dark_bg BOOLEAN DEFAULT false,
  card_bg BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.home_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active home sections" ON public.home_sections FOR SELECT USING (true);
CREATE POLICY "Admins can manage home sections" ON public.home_sections FOR ALL USING (is_admin());

CREATE TRIGGER update_home_sections_updated_at BEFORE UPDATE ON public.home_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
