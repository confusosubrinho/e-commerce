import { lazy, Suspense } from 'react';
import { StoreLayout } from '@/components/store/StoreLayout';
import { FadeInOnScroll } from '@/components/store/FadeInOnScroll';
import { BannerCarousel } from '@/components/store/BannerCarousel';
import { FeaturesBar } from '@/components/store/FeaturesBar';
import { ShopifyProductGrid } from '@/components/shopify/ShopifyProductGrid';
import { useShopifyProducts } from '@/hooks/useShopifyProducts';

const Newsletter = lazy(() =>
  import('@/components/store/Newsletter').then((m) => ({ default: m.Newsletter }))
);

const SectionFallback = () => <div className="py-12" />;

const Index = () => {
  const { data: products, isLoading } = useShopifyProducts({ first: 12 });

  return (
    <StoreLayout>
      <BannerCarousel />
      <FeaturesBar />

      <FadeInOnScroll>
        <ShopifyProductGrid
          title="Nossa coleção"
          subtitle="Explore nossos produtos mais recentes"
          products={products ?? []}
          isLoading={isLoading}
        />
      </FadeInOnScroll>

      <Suspense fallback={<SectionFallback />}>
        <Newsletter />
      </Suspense>
    </StoreLayout>
  );
};

export default Index;
