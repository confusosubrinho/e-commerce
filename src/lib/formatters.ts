/**
 * Centralized formatting utilities and order status constants.
 * Single source of truth – import from here, never redefine localmente.
 */

// ─── Currency ───

export const formatPrice = (price: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

/** Alias for pricingEngine compatibility */
export const formatCurrency = formatPrice;

// ─── Dates ───

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
  paid: 'Pago',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  failed: 'Falhou',
};

/** Tailwind classes for Badge styling in tables/lists */
export const ORDER_STATUS_BADGE_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-orange-100 text-orange-800',
  failed: 'bg-red-100 text-red-800',
};

/** Hex colors for charts (Recharts / pie / bar) */
export const ORDER_STATUS_CHART_COLORS: Record<string, string> = {
  pending: '#eab308',
  processing: '#3b82f6',
  paid: '#22c55e',
  shipped: '#8b5cf6',
  delivered: '#10b981',
  cancelled: '#ef4444',
  refunded: '#f97316',
  failed: '#dc2626',
};

// ─── Provider ───

export const getProviderLabel = (provider: string | null | undefined): string => {
  if (provider === 'stripe') return 'Stripe';
  if (provider === 'appmax') return 'Appmax';
  if (provider === 'yampi') return 'Yampi';
  return 'Site';
};
