import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useHorizontalScrollAxisLock } from '@/hooks/useHorizontalScrollAxisLock';

interface TestimonialConfig {
  is_active: boolean;
  title: string;
  subtitle: string;
  bg_color: string;
  card_color: string;
  star_color: string;
  text_color: string;
  cards_per_view: number;
  autoplay: boolean;
  autoplay_speed: number;
  show_google_summary: boolean | null;
  google_rating: number | string | null;
  google_reviews_count: number | null;
  google_profile_url: string | null;
}

/** Logo "G" do Google em SVG (evita depender de imagem externa). */
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.7l7.8 6.1C12.3 13.8 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4.1H24v7.8h12.7c-.3 2.1-1.6 5.2-4.7 7.3l7.2 5.6c4.3-4 7.3-9.9 7.3-16.6z" />
      <path fill="#FBBC05" d="M10.4 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C1 16.2 0 20 0 24s1 7.8 2.6 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.3-5.6l-7.2-5.6c-2 1.4-4.6 2.3-8.1 2.3-6.4 0-11.7-4.3-13.6-10.2l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z" />
    </svg>
  );
}

interface ProductImage {
  url: string;
  is_primary: boolean | null;
}

interface Testimonial {
  id: string;
  customer_name: string;
  rating: number;
  testimonial: string;
  display_order: number;
  is_active: boolean;
  photo_url: string | null;
  product_id: string | null;
  product: { id: string; name: string; slug: string; images: ProductImage[] } | null;
}

export function CustomerTestimonials() {
  const scrollRef = useHorizontalScrollAxisLock();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const { data: config } = useQuery({
    queryKey: ['testimonials-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homepage_testimonials_config')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as unknown as TestimonialConfig;
    },
  });

  const { data: testimonials } = useQuery({
    queryKey: ['testimonials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homepage_testimonials')
        .select('*, product:products(id, name, slug, images:product_images(url, is_primary))')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data as unknown as Testimonial[]) || [];
    },
  });

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    updateScrollButtons();
    return () => el.removeEventListener('scroll', updateScrollButtons);
  }, [testimonials, updateScrollButtons, scrollRef]);

  // Autoplay
  useEffect(() => {
    if (!config?.autoplay || !testimonials?.length) return;
    const speed = (config.autoplay_speed || 5) * 1000;
    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const cardWidth = el.querySelector('.testimonial-card')?.clientWidth || 300;
      const gap = 24;
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 5) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: cardWidth + gap, behavior: 'smooth' });
      }
    }, speed);
    return () => clearInterval(interval);
  }, [config?.autoplay, config?.autoplay_speed, testimonials?.length, scrollRef]);

  if (!config?.is_active || !testimonials?.length) return null;

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('.testimonial-card')?.clientWidth || 300;
    const gap = 24;
    el.scrollBy({ left: dir === 'left' ? -(cardWidth + gap) : cardWidth + gap, behavior: 'smooth' });
  };

  const cardsPerView = config.cards_per_view || 4;

  const getProductImage = (images: ProductImage[] | null | undefined): string | null => {
    if (!images?.length) return null;
    const primary = images.find(i => i.is_primary);
    return primary?.url || images[0]?.url || null;
  };

  return (
    <section className="py-12 md:py-16" style={{ backgroundColor: config.bg_color }}>
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-light italic mb-2" style={{ color: config.text_color }}>
            {config.title}
          </h2>
          <p className="text-sm md:text-base opacity-70" style={{ color: config.text_color }}>
            {config.subtitle}
          </p>
          <div className="w-16 h-0.5 bg-current mx-auto mt-4 opacity-40" style={{ color: config.text_color }} />
        </div>

        {/* Resumo do Google Meu Negócio */}
        {googleRating !== null && (
          <div className="flex justify-center mb-8">
            <div
              className="flex items-center gap-3 sm:gap-4 rounded-full px-4 sm:px-5 py-2.5 shadow-sm"
              style={{ backgroundColor: config.card_color, color: config.text_color }}
            >
              <GoogleGlyph className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-semibold leading-none">
                  {googleRating.toFixed(1).replace('.', ',')}
                </span>
                <div className="flex gap-0.5" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                      fill={i < Math.round(googleRating) ? config.star_color : 'transparent'}
                      stroke={i < Math.round(googleRating) ? config.star_color : '#ccc'}
                    />
                  ))}
                </div>
              </div>
              {config.google_reviews_count ? (
                <span className="text-xs sm:text-sm opacity-70 leading-none">
                  {config.google_reviews_count} avaliações no Google
                </span>
              ) : (
                <span className="text-xs sm:text-sm opacity-70 leading-none">Avaliações no Google</span>
              )}
              {config.google_profile_url && (
                <a
                  href={config.google_profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm font-medium underline underline-offset-2 hover:opacity-70 transition-opacity whitespace-nowrap"
                  style={{ color: config.text_color }}
                >
                  Ver no Google
                </a>
              )}
            </div>
          </div>
        )}

        {/* Carousel */}
        <div className="relative">
          {canScrollLeft && (
            <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/80 shadow-md flex items-center justify-center hover:bg-white transition-colors -ml-2 md:-ml-5" aria-label="Anterior">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
          )}

          <div ref={scrollRef} className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth px-1 py-2 cursor-grab active:cursor-grabbing" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
            {testimonials.map((t) => (
              <div
                key={t.id}
                className="testimonial-card flex-shrink-0 rounded-xl p-6 shadow-sm flex flex-col items-center text-center"
                style={{
                  backgroundColor: config.card_color,
                  color: config.text_color,
                  width: `calc((100% - ${(cardsPerView - 1) * 24}px) / ${cardsPerView})`,
                  minWidth: '260px',
                }}
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-semibold text-gray-500 mb-3 overflow-hidden">
                  {t.photo_url ? (
                    <img src={t.photo_url} alt={t.customer_name} className="w-full h-full object-cover" />
                  ) : (
                    t.customer_name.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Stars */}
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4" fill={i < t.rating ? config.star_color : 'transparent'} stroke={i < t.rating ? config.star_color : '#ccc'} />
                  ))}
                </div>

                {/* Text */}
                <p className="text-sm leading-relaxed flex-1 mb-4 opacity-80">{t.testimonial}</p>

                {/* Name */}
                <p className="font-semibold text-sm">{t.customer_name}</p>

                {/* Product link */}
                {t.product && (
                  <a
                    href={`/produto/${t.product.slug}`}
                    className="mt-2 flex items-center gap-1.5 text-[11px] opacity-60 hover:opacity-100 transition-opacity"
                    style={{ color: config.text_color }}
                  >
                    {getProductImage(t.product.images) && (
                      <img src={getProductImage(t.product.images)!} alt="" className="w-4 h-4 object-cover rounded-sm" />
                    )}
                    🛍️ {t.product.name}
                  </a>
                )}
              </div>
            ))}
          </div>

          {canScrollRight && (
            <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/80 shadow-md flex items-center justify-center hover:bg-white transition-colors -mr-2 md:-mr-5" aria-label="Próximo">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
