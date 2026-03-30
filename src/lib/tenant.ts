/**
 * Fase 7/8 – Multi-tenant: tenant padrão e resolução por domínio/path.
 * Ver docs/MULTITENANT_DESIGN.md.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const SUPERADMIN_IMPERSONATE_TENANT_ID_KEY = 'superadmin_impersonate_tenant_id';

/** Domínio considerado "principal" (sem customização); nesses casos usa tenant padrão. */
export const MAIN_DOMAIN_ALIASES = ['localhost', '127.0.0.1'];

/**
 * Retorna o tenant ativo de forma síncrona (SSR ou fallback).
 * Sempre retorna o tenant padrão; para resolução por domínio/path use resolveTenantIdAsync.
 */
export function resolveTenantId(): string {
  return DEFAULT_TENANT_ID;
}

export function setImpersonatedTenantId(tenantId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SUPERADMIN_IMPERSONATE_TENANT_ID_KEY, tenantId);
}

export function clearImpersonatedTenantId() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SUPERADMIN_IMPERSONATE_TENANT_ID_KEY);
}

function getImpersonatedTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SUPERADMIN_IMPERSONATE_TENANT_ID_KEY);
}

/**
 * Resolve tenant por domínio (tenants.domain).
 * Retorna id do tenant ou null se não encontrar.
 */
export async function getTenantIdByDomain(
  supabase: SupabaseClient,
  hostname: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('domain', hostname)
    .eq('active', true)
    .maybeSingle();
  if (error || !data?.id) return null;
  return data.id as string;
}

/**
 * Resolve tenant por slug (tenants.slug).
 * Retorna id do tenant ou null se não encontrar.
 */
export async function getTenantIdBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  if (error || !data?.id) return null;
  return data.id as string;
}

/**
 * Extrai slug do path no formato /loja/:slug (primeiro segmento após /loja/).
 * Ex.: /loja/minha-loja/... → "minha-loja"
 */
export function getSlugFromPath(pathname: string): string | null {
  const match = /^\/loja\/([^/]+)/.exec(pathname);
  return match ? match[1] : null;
}

/**
 * Resolve o tenant ativo a partir do contexto do browser (hostname + path).
 * Ordem: 1) domínio customizado (tenants.domain), 2) path /loja/:slug (tenants.slug), 3) tenant padrão.
 */
export async function resolveTenantIdAsync(supabase: SupabaseClient): Promise<string> {
  if (typeof window === 'undefined') return DEFAULT_TENANT_ID;

  // Super Admin impersonation (somente conveniência de navegação no admin)
  const impersonatedTenantId = getImpersonatedTenantId();
  if (impersonatedTenantId) {
    const { data } = await supabase
      .from('tenants')
      .select('id, active')
      .eq('id', impersonatedTenantId)
      .eq('active', true)
      .maybeSingle();
    if (data?.id) return data.id as string;
    clearImpersonatedTenantId();
  }

  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  if (MAIN_DOMAIN_ALIASES.includes(hostname)) {
    const slugFromPath = getSlugFromPath(pathname);
    if (slugFromPath) {
      const id = await getTenantIdBySlug(supabase, slugFromPath);
      if (id) return id;
    }
    return DEFAULT_TENANT_ID;
  }

  const byDomain = await getTenantIdByDomain(supabase, hostname);
  if (byDomain) return byDomain;

  const slugFromPath = getSlugFromPath(pathname);
  if (slugFromPath) {
    const bySlug = await getTenantIdBySlug(supabase, slugFromPath);
    if (bySlug) return bySlug;
  }

  return DEFAULT_TENANT_ID;
}
