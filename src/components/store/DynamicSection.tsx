import { HomeSection, useSectionProducts, getViewAllLink } from '@/hooks/useHomeSections';
import { ProductCarousel } from './ProductCarousel';
import { ProductGrid } from './ProductGrid';

interface DynamicSectionProps {
  section: HomeSection;
}

export function DynamicSection({ section }: DynamicSectionProps) {
  const { data: products, isLoading } = useSectionProducts(section);

  if (!isLoading && (!products || products.length === 0)) return null;

  const viewAllLink = getViewAllLink(section);

  if (section.section_type === 'grid') {
    return (
      <ProductGrid
        products={products || []}
        title={section.title}
        subtitle={section.subtitle || undefined}
        isLoading={isLoading}
        showViewAll={section.show_view_all}
        viewAllLink={viewAllLink}
      />
    );
  }

  return (
    <ProductCarousel
      products={products || []}
      title={section.title}
      subtitle={section.subtitle || undefined}
      isLoading={isLoading}
      showViewAll={section.show_view_all}
      viewAllLink={viewAllLink}
      darkBg={section.dark_bg}
      cardBg={section.card_bg}
    />
  );
}
