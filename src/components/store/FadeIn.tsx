import { type ReactNode } from 'react';

interface FadeInProps {
  children: ReactNode;
  /** Classe adicional. Padrão: animate-content-in (fade + slide up suave) */
  className?: string;
  /** Se true, usa apenas fade (sem slide). Útil para overlays. */
  fadeOnly?: boolean;
}

/**
 * Envolve o conteúdo com animação de entrada suave (fade + slide up).
 * Use quando o conteúdo substitui um loading/skeleton para evitar transição brusca.
 */
export function FadeIn({ children, className = '', fadeOnly }: FadeInProps) {
  const animClass = fadeOnly ? 'animate-fade-in-soft' : 'animate-content-in';
  return <div className={`${animClass} ${className}`.trim()}>{children}</div>;
}
