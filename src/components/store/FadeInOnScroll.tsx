import { type ReactNode, useRef, useState, useEffect } from 'react';

interface FadeInOnScrollProps {
  children: ReactNode;
  className?: string;
  rootMargin?: string;
  threshold?: number;
  fadeOnly?: boolean;
  delay?: number;
}

/**
 * Fade-in quando o elemento entra na viewport ao rolar (Intersection Observer).
 */
export function FadeInOnScroll({
  children,
  className = '',
  rootMargin = '40px',
  threshold = 0.08,
  fadeOnly = false,
  delay = 0,
}: FadeInOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [delayedVisible, setDelayedVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setIsVisible(true);
      },
      { rootMargin, threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  useEffect(() => {
    if (!isVisible) return;
    if (delay <= 0) {
      setDelayedVisible(true);
      return;
    }
    const t = setTimeout(() => setDelayedVisible(true), delay);
    return () => clearTimeout(t);
  }, [isVisible, delay]);

  const visibleClass = delayedVisible ? 'fade-in-on-scroll-visible' : '';
  const variantClass = fadeOnly ? 'fade-in-on-scroll--fade-only' : '';
  return (
    <div
      ref={ref}
      className={`fade-in-on-scroll ${variantClass} ${visibleClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
