// Capturado antes de o cliente Supabase ler e limpar o hash da URL de recuperação.
export const isPasswordRecoveryLanding =
  typeof window !== 'undefined' && /(^|[#&])type=recovery(&|$)/.test(window.location.hash);
