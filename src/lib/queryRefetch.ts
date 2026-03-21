import type { Query } from '@tanstack/react-query';

/**
 * Intervalos de refetch (ms) alinhados para reduzir chamadas ao Supabase com aba ativa.
 * Com aba em segundo plano, refetchIntervalWhenVisible pausa.
 */
export const REFETCH_MS = {
  /** Painéis de saúde / webhook recente */
  adminHealthRecent: 120_000,
  /** Agregados (24h, produtos) */
  adminHealthAggregate: 180_000,
  /** Notificações admin */
  adminNotifications: 120_000,
  /** Indicador flutuante de erros */
  adminErrorsIndicator: 120_000,
  /** Monitor Bling (Integrações) */
  blingMonitor: 120_000,
  /** Lista de app logs ao vivo */
  appLogsLive: 60_000,
  /** Estoque no carrinho */
  cartStock: 90_000,
} as const;

/** Polling manual (setInterval) — PIX guest / status pedido guest */
export const POLL_MS = {
  checkoutPixGuest: 8_000,
  orderConfirmationGuest: 15_000,
} as const;

/**
 * Pausa o refetch automático do React Query quando a aba está em segundo plano.
 */
export function refetchIntervalWhenVisible(intervalMs: number) {
  return (_query: Query) => {
    if (typeof document === 'undefined') return false;
    return document.hidden ? false : intervalMs;
  };
}
