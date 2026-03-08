/**
 * Centralized formatting utilities and order status constants for the admin panel.
 * Eliminates duplication across Dashboard, Orders, Customers, Products, etc.
 */

export const formatPrice = (price: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

export const formatDate = (date: string): string =>
  new Date(date).toLocaleDateString('pt-BR');

export const formatDateTime = (date: string): string =>
  new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// ─── Order Status ───

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  processing: 'Processando',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

/** Tailwind classes for Badge styling in tables/lists */
export const ORDER_STATUS_BADGE_COLORS: Record<string, string> = {
  pending: 'bg-warning/20 text-warning-foreground border-warning',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-success/20 text-success border-success',
  cancelled: 'bg-destructive/20 text-destructive',
};

/** Hex colors for charts (Recharts / pie / bar) */
export const ORDER_STATUS_CHART_COLORS: Record<string, string> = {
  pending: '#eab308',
  processing: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#22c55e',
  cancelled: '#ef4444',
};

export const getProviderLabel = (provider: string | null | undefined): string => {
  if (provider === 'stripe') return 'Stripe';
  if (provider === 'appmax') return 'Appmax';
  if (provider === 'yampi') return 'Yampi';
  return 'Site';
};
