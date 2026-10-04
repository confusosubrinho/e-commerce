import type { Query } from '@tanstack/react-query';

/**
 * Intervalos de refetch (ms) alinhados para reduzir chamadas ao Supabase com aba ativa.
 * Com aba em segundo plano, refetchIntervalWhenVisible pausa.
 */
export const REFETCH_MS = {
  /** Notificações admin */
  adminNotifications: 120_000,
} as const;

/** Polling manual (setInterval) — PIX guest / status pedido guest */
export const POLL_MS = {
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
