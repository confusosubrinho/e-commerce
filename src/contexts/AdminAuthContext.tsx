/**
 * FASE 4 / BUG-ADMIN-01, 08: Watchdog 401/403 — sessão expirada ou não autorizada.
 * Componentes do admin podem chamar onSessionExpired() ao receber 401/403 para
 * limpar cache, fazer logout e redirecionar para /admin/login.
 */
import { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type AdminAuthContextValue = {
  onSessionExpired: (message?: string) => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);
const UNAUTHORIZED_EVENT_COOLDOWN_MS = 1500;
const SESSION_EXPIRY_COOLDOWN_MS = 5000;

export function useAdminSessionExpired(): AdminAuthContextValue['onSessionExpired'] {
  const ctx = useContext(AdminAuthContext);
  return ctx?.onSessionExpired ?? (() => {});
}

export function AdminAuthProvider({
  children,
  onSessionExpired,
}: {
  children: React.ReactNode;
  onSessionExpired: (message?: string) => void;
}) {
  // Ref estável para evitar recriar o wrapper de fetch a cada render
  const onSessionExpiredRef = useRef(onSessionExpired);
  const lastUnauthorizedEventAtRef = useRef(0);
  useEffect(() => { onSessionExpiredRef.current = onSessionExpired; }, [onSessionExpired]);

  const value: AdminAuthContextValue = { onSessionExpired };

  // Watchdog global para capturar erros 401/403 em requisições — montado apenas uma vez
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      if (response.status === 401 || response.status === 403) {
        const url = typeof args[0] === 'string'
          ? args[0]
          : (args[0] instanceof Request ? args[0].url : '');

        const isSupabaseRequest = url.includes('supabase.co') || url.includes(import.meta.env.VITE_SUPABASE_URL || 'supabase');
        const isDataEndpoint = url.includes('/rest/v1/') || url.includes('/functions/v1/');

        // Não interceptar requests de auth para evitar loop na hora de logar ou renovar token
        const isAuthEndpoint = url.includes('/auth/v1/');

        if (isSupabaseRequest && isDataEndpoint && !isAuthEndpoint) {
          const now = Date.now();
          if (now - lastUnauthorizedEventAtRef.current >= UNAUTHORIZED_EVENT_COOLDOWN_MS) {
            lastUnauthorizedEventAtRef.current = now;
            onSessionExpiredRef.current('Sessão expirada ou acesso negado. Faça login novamente.');
          }
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

/**
 * Hook para ser usado dentro de AdminLayout: retorna a função a ser passada ao provider.
 */
export function useAdminAuthProviderValue(): AdminAuthContextValue['onSessionExpired'] {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isHandlingSessionExpiryRef = useRef(false);
  const lastSessionExpiryAtRef = useRef(0);

  return useCallback(
    (message?: string) => {
      const now = Date.now();
      if (isHandlingSessionExpiryRef.current) return;
      if (now - lastSessionExpiryAtRef.current < SESSION_EXPIRY_COOLDOWN_MS) return;

      isHandlingSessionExpiryRef.current = true;
      lastSessionExpiryAtRef.current = now;
      queryClient.clear();

      void (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.auth.signOut();
          }
        } finally {
          navigate('/admin/login', { replace: true, state: { sessionExpired: true, message } });
          isHandlingSessionExpiryRef.current = false;
        }
      })();
    },
    [queryClient, navigate]
  );
}
