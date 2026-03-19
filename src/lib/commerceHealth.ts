import type { SupabaseClient } from '@supabase/supabase-js';

/** Resultado da RPC commerce_health (integridade de pagamentos/estoque/pedidos). */
export interface CommerceHealthResult {
  ok: boolean;
  error?: string;
  checks?: {
    index_payments_provider_transaction_id?: boolean;
    duplicate_payments_count?: number;
    negative_stock_count?: number;
    orders_paid_without_payment_count?: number;
    payments_succeeded_without_order_paid_count?: number;
    last_stripe_webhook_at?: string | null;
  };
}

/** Resultado da RPC commerce_health_lists (listas para ações de correção). */
export interface CommerceHealthListsResult {
  ok: boolean;
  paid_without_payment_order_ids?: string[];
  duplicate_payment_order_ids?: string[];
  expired_reservation_order_ids?: string[];
}

/**
 * Chama a RPC commerce_health e retorna o resultado tipado.
 * Uso: Admin / Commerce Health para checagens de integridade.
 */
export async function fetchCommerceHealth(
  supabase: SupabaseClient
): Promise<CommerceHealthResult> {
  const { data, error } = await supabase.rpc('commerce_health');
  if (error) throw error;
  return (data ?? { ok: false }) as CommerceHealthResult;
}

/**
 * Chama a RPC commerce_health_lists e retorna o resultado tipado.
 * Uso: Admin / Commerce Health para listas de pedidos com problemas.
 */
export async function fetchCommerceHealthLists(
  supabase: SupabaseClient
): Promise<CommerceHealthListsResult> {
  const { data, error } = await supabase.rpc('commerce_health_lists');
  if (error) throw error;
  return (data ?? { ok: false }) as CommerceHealthListsResult;
}
