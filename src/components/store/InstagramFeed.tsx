import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface InstagramVideo {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  username: string | null;
  product_id: string | null;
  display_order: number;
  is_active: boolean;
  product?: {
    id: string;
    name: string;
    slug: string;
    images?: { url: string; is_primary: boolean }[];
  } | null;
}

function normalizeMediaUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed === 'null' || trimmed === 'undefined') return '';
  try {
    const url = new URL(trimmed);
    // Handle Supabase signed URL -> public URL (bucket público)
    if (url.pathname.includes('/storage/v1/object/sign/')) {
      url.pathname = url.pathname.replace('/storage/v1/object/sign/', '/storage/v1/object/public/');
      url.search = '';
    }
    return encodeURI(url.toString());
  } catch {
    return encodeURI(trimmed);
  }
}

export function InstagramFeed() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedVideoIds, setFailedVideoIds] = useState<Record<string, boolean>>({});
  const [readyVideoIds, setReadyVideoIds] = useState<Record<string, boolean>>({});
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [failedImageKeys, setFailedImageKeys] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const { data: videos } = useQuery({
    queryKey: ['instagram-videos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instagram_videos')
        .select('*, product:products(id, name, slug, images:product_images(url, is_primary))')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      const rows = (data as unknown as InstagramVideo[]) || [];
      return rows.filter((row) => normalizeMediaUrl(row.video_url).length > 0);
    },
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    if (!scrollRef.current || !videos) return;
    const container = scrollRef.current;
    const items = container.children;
    if (!items[index]) return;
    const item = items[index] as HTMLElement;
    const scrollLeft = item.offsetLeft - container.offsetWidth / 2 + item.offsetWidth / 2;
    container.scrollTo({ left: scrollLeft, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }, [videos, prefersReducedMotion]);

  useEffect(() => {
    if (!videos || videos.length === 0) return;
    setActiveIndex((prev) => {
      if (prev >= 0 && prev < videos.length) return prev;
      return Math.floor((videos.length - 1) / 2);
    });
    const next = Math.floor((videos.length - 1) / 2);
    const timer = setTimeout(() => scrollToIndex(next), 50);
    return () => clearTimeout(timer);
  }, [videos, scrollToIndex]);

  // Auto-play active video, pause others
  useEffect(() => {
    if (!videos) return;
    const cleanups: (() => void)[] = [];

    // Small delay to ensure refs are registered after render
    const timer = setTimeout(() => {
      videoRefs.current.forEach((video, id) => {
        const idx = videos.findIndex(v => v.id === id);
        if (idx < 0) return;
        if (failedVideoIds[id]) {
          video.pause();
          return;
        }
        if (idx === activeIndex) {
          // Force load if needed
          if (video.preload !== 'auto') video.preload = 'auto';
          if (!video.src && video.dataset.src) video.src = video.dataset.src;
          if (prefersReducedMotion) {
            video.pause();
            return;
          }
          
          const playWhenReady = () => {
            video.muted = true; // ensure muted for autoplay policy
            video.play().catch(() => {});
          };
          if (video.readyState >= 2) {
            playWhenReady();
          } else {
            video.load(); // force reload
            const onCanPlay = () => {
              video.removeEventListener('canplay', onCanPlay);
              playWhenReady();
            };
            video.addEventListener('canplay', onCanPlay);
            cleanups.push(() => video.removeEventListener('canplay', onCanPlay));
          }
        } else {
          video.pause();
        }
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanups.forEach(fn => fn());
    };
  }, [activeIndex, videos, failedVideoIds, prefersReducedMotion]);

  // No auto-advance - manual scroll only

  const goTo = (direction: 'prev' | 'next') => {
    if (!videos) return;
    setActiveIndex(prev => {
      const next = direction === 'prev'
        ? (prev <= 0 ? videos.length - 1 : prev - 1)
        : (prev >= videos.length - 1 ? 0 : prev + 1);
      setTimeout(() => scrollToIndex(next), 0);
      return next;
    });
  };

  const handleCarouselScroll = () => {
    if (!scrollRef.current || !videos || videos.length === 0) return;
    if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) return;
      const center = container.scrollLeft + container.clientWidth / 2;
      const items = Array.from(container.children) as HTMLElement[];
      if (items.length === 0) return;
      let bestIndex = activeIndex;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < items.length; i++) {
        const itemCenter = items[i].offsetLeft + items[i].offsetWidth / 2;
        const distance = Math.abs(itemCenter - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
      if (bestIndex !== activeIndex) setActiveIndex(bestIndex);
    });
  };

  const onSectionKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!videos || videos.length === 0) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo('prev');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo('next');
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      scrollToIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = videos.length - 1;
      setActiveIndex(last);
      scrollToIndex(last);
    }
  };

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  if (!videos || videos.length === 0) {
    // Fallback placeholder
    return (
      <section className="relative overflow-hidden py-14">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-100 via-zinc-50 to-zinc-100" />
        <div className="container-custom relative text-center">
          <span className="inline-flex items-center rounded-full border bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Inspire-se
          </span>
          <h2 className="mt-3 text-2xl font-bold md:text-3xl">Looks Reais, Escolhas Reais</h2>
          <p className="mt-2 text-muted-foreground">Em breve, vídeos com nossos produtos favoritos.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden py-14 focus:outline-none"
      onKeyDown={onSectionKeyDown}
      aria-label="Carrossel de vídeos de inspiração"
      tabIndex={0}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-100 via-zinc-50 to-zinc-100" />
      <div className="absolute left-1/2 top-16 h-44 w-[32rem] -translate-x-1/2 rounded-full bg-zinc-200/60 blur-3xl" />

      <div className="container-custom relative">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center rounded-full border bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Inspiração em movimento
          </span>
          <h2 className="mt-3 text-2xl font-bold md:text-3xl">Looks Reais, Escolhas Reais</h2>
          <p className="mt-2 text-muted-foreground">Veja como nossas clientes usam e clique para comprar.</p>
        </div>
      </div>

      <div className="relative px-3 md:px-0">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-10 bg-gradient-to-r from-zinc-100 to-transparent md:w-20" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-10 bg-gradient-to-l from-zinc-100 to-transparent md:w-20" />

        {/* Navigation arrows */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => goTo('prev')}
          className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/90 shadow-lg hover:bg-background md:inline-flex"
          aria-label="Vídeo anterior"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => goTo('next')}
          className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/90 shadow-lg hover:bg-background md:inline-flex"
          aria-label="Próximo vídeo"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>

        {/* Carousel */}
        <div
          ref={scrollRef}
          onScroll={handleCarouselScroll}
          className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto py-2 md:gap-5"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', paddingLeft: 'max(0.75rem, calc(50% - 170px))', paddingRight: 'max(0.75rem, calc(50% - 170px))' }}
          role="list"
          aria-label="Lista de vídeos"
        >
          {videos.map((video, index) => {
            const thumbKey = `thumb-${video.id}`;
            const productImageKey = `product-${video.id}`;
            const isActive = index === activeIndex;
            const productImage = video.product?.images?.find(i => i.is_primary)?.url || video.product?.images?.[0]?.url;
            const normalizedThumbUrl = normalizeMediaUrl(video.thumbnail_url);
            const normalizedProductImage = normalizeMediaUrl(productImage);
            const thumbAvailable = Boolean(normalizedThumbUrl) && !failedImageKeys[thumbKey];
            const productImageAvailable = Boolean(normalizedProductImage) && !failedImageKeys[productImageKey];
            const hasThumbnail = thumbAvailable;
            const hasFailed = !!failedVideoIds[video.id];
            const isReady = !!readyVideoIds[video.id];
            const fallbackMedia = thumbAvailable ? normalizedThumbUrl : productImageAvailable ? normalizedProductImage : null;
            const normalizedVideoUrl = normalizeMediaUrl(video.video_url);

            return (
              <div
                key={video.id}
                className={`group flex-shrink-0 snap-center cursor-pointer transition-all duration-500 ${
                  isActive ? 'w-[220px] sm:w-[260px] md:w-[330px] scale-100 opacity-100' : 'w-[180px] sm:w-[220px] md:w-[280px] scale-[0.96] opacity-70'
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2`}
                onClick={() => {
                  setActiveIndex(index);
                  scrollToIndex(index);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveIndex(index);
                    scrollToIndex(index);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Selecionar vídeo ${index + 1}`}
                aria-current={isActive ? 'true' : 'false'}
              >
                {/* Video container */}
                <div className={`relative overflow-hidden rounded-2xl bg-black ring-1 ring-black/10 ${
                  isActive ? 'aspect-[9/16] shadow-2xl ring-2 ring-white/60' : 'aspect-[9/16] shadow-md'
                }`}>
                  {!isReady && !hasFailed && (
                    <div className="absolute inset-0 animate-pulse bg-zinc-700/80" />
                  )}

                  {/* Thumbnail configurado */}
                  {hasThumbnail && !hasFailed && (
                    <img
                      src={normalizedThumbUrl}
                      alt={video.username ? `@${video.username}` : 'Video'}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${(isActive && isReady) ? 'opacity-0' : 'opacity-100'}`}
                      loading="lazy"
                      onError={() => {
                        setFailedImageKeys((prev) => ({ ...prev, [thumbKey]: true }));
                      }}
                    />
                  )}
                  {!hasFailed ? (
                    <video
                      ref={(el) => {
                        if (el) videoRefs.current.set(video.id, el);
                        else videoRefs.current.delete(video.id);
                      }}
                      src={normalizedVideoUrl}
                      poster={fallbackMedia || undefined}
                      className="absolute inset-0 w-full h-full object-cover"
                      loop
                      muted
                      playsInline
                      preload={isActive ? 'auto' : 'metadata'}
                      onLoadedData={() => {
                        setReadyVideoIds((prev) => (prev[video.id] ? prev : { ...prev, [video.id]: true }));
                      }}
                      onError={(e) => {
                        const target = e.currentTarget;
                        setFailedVideoIds((prev) => ({ ...prev, [video.id]: true }));
                        console.warn('[InstagramFeed] Video load error:', normalizedVideoUrl, target.error?.message);
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0">
                      {fallbackMedia ? (
                        <img
                          src={fallbackMedia}
                          alt={video.username ? `@${video.username}` : 'Conteúdo'}
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                          onError={() => {
                            setFailedImageKeys((prev) => ({
                              ...prev,
                              [thumbKey]: true,
                              [productImageKey]: true,
                            }));
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900" />
                      )}
                      <div className="absolute inset-0 bg-black/45" />
                      <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/60 px-3 py-2 text-[11px] text-white backdrop-blur-sm">
                        Vídeo indisponível no momento
                      </div>
                    </div>
                  )}

                  {isActive && !hasFailed && (
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
                  )}

                  {/* Username overlay */}
                  {video.username && (
                    <div className="absolute top-3 left-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                      @{video.username}
                    </div>
                  )}
                </div>

                {/* Product link below video */}
                {video.product && (
                  <Link
                    to={`/produto/${video.product.slug}`}
                    className={`mt-3 flex items-center gap-2 rounded-xl border bg-background p-2 transition-all ${
                      isActive ? 'border-zinc-300 shadow-sm' : 'border-zinc-200'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Ver produto ${video.product.name}`}
                  >
                    {productImageAvailable && (
                      <img
                        src={normalizedProductImage}
                        alt={video.product.name}
                        className="w-10 h-10 rounded object-cover"
                        onError={() => {
                          setFailedImageKeys((prev) => ({ ...prev, [productImageKey]: true }));
                        }}
                      />
                    )}
                    <span className="text-xs font-medium line-clamp-2 flex-1">
                      {video.product.name}
                    </span>
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 md:hidden">
          {videos.map((video, index) => (
            <button
              key={`dot-${video.id}`}
              type="button"
              aria-label={`Ir para o vídeo ${index + 1}`}
              onClick={() => {
                setActiveIndex(index);
                scrollToIndex(index);
              }}
              className={`h-2 rounded-full transition-all ${
                index === activeIndex ? 'w-6 bg-zinc-900' : 'w-2 bg-zinc-400/60'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
