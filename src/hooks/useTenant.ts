import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_TENANT_ID, resolveTenantIdAsync } from '@/lib/tenant';

/**
 * Fase 7/8 – Tenant ativo na sessão (loja).
 * Resolve por domínio (tenants.domain), path (/loja/:slug) ou tenant padrão.
 */
export function useTenant() {
  const { data: tenantId, isLoading } = useQuery({
    queryKey: ['tenant', typeof window !== 'undefined' ? window.location.hostname : '', typeof window !== 'undefined' ? window.location.pathname : ''],
    queryFn: () => resolveTenantIdAsync(supabase),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    placeholderData: DEFAULT_TENANT_ID,
  });

  return {
    tenantId: tenantId ?? DEFAULT_TENANT_ID,
    isLoading,
  };
}
