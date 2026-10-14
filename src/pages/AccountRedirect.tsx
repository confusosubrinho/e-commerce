import { lazy, useEffect } from 'react';
import { SHOPIFY_ACCOUNT_URL } from '@/lib/shopify/client';
import { isPasswordRecoveryLanding } from '@/lib/authRecovery';

const AdminLogin = lazy(() => import('./admin/AdminLogin'));

export function ShopifyAccountRedirect() {
  useEffect(() => {
    window.location.replace(SHOPIFY_ACCOUNT_URL);
  }, []);
  return null;
}

// /auth recebe os links de recuperação de senha do painel (URL já liberada no Supabase Auth).
export function AuthLanding() {
  return isPasswordRecoveryLanding ? <AdminLogin /> : <ShopifyAccountRedirect />;
}
