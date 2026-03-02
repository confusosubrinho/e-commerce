import { useState, useEffect, useRef } from 'react';

/**
 * Observa se o elemento está no viewport. Uso: reduzir requisições na árvore crítica
 * (ex.: só buscar product_reviews quando o card estiver visível).
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(options?: { rootMargin?: string; threshold?: number }) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const rootMargin = options?.rootMargin ?? '100px';
  const threshold = options?.threshold ?? 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { rootMargin, threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return { ref, inView };
}
