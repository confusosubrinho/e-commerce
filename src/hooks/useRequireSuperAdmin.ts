import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminRole } from '@/hooks/useAdminRole';

/**
 * Garante que apenas super_admin ou owner acessem a área Super Admin.
 * Redireciona para /admin se o usuário não tiver permissão.
 */
export function useRequireSuperAdmin() {
  const navigate = useNavigate();
  const { role, isLoading } = useAdminRole();

  const isSuperAdmin = role === 'super_admin' || role === 'owner';

  useEffect(() => {
    if (isLoading) return;
    if (!isSuperAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [isLoading, isSuperAdmin, navigate]);

  return { isSuperAdmin, isLoading, role };
}
