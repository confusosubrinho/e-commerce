/**
 * Helpers de autenticação para Edge Functions privilegiadas.
 *
 * Regras:
 * - `verify_jwt = false` está ativo na maioria das funções, então a validação
 *   precisa acontecer aqui, no código, e sempre em modo fail-closed.
 * - Nunca aceite um header `Authorization` apenas porque ele começa com "Bearer ".
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_MEMBER_ROLES = ['super_admin', 'owner', 'manager', 'operator', 'admin'];

export interface AuthResult {
  ok: boolean;
  /** Preenchido quando a autenticação foi feita via JWT de um usuário admin. */
  userId?: string;
  /** true quando a chamada veio do service_role key ou de um cron secret válido. */
  isService?: boolean;
  /** Motivo textual da recusa (apenas para log interno). */
  reason?: string;
  status?: number;
}

function extractBearer(req: Request): string | null {
  const header = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/**
 * Valida se a requisição usa a service_role key ou um cron secret configurado.
 * Fail-closed: se o segredo de cron não estiver configurado, ele simplesmente
 * não é aceito como forma de autenticação (nunca libera a chamada).
 */
export function isServiceOrCronRequest(req: Request, cronSecretEnvName?: string): boolean {
  const token = extractBearer(req);
  if (!token) return false;

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceRoleKey && token === serviceRoleKey) return true;

  if (cronSecretEnvName) {
    const cronSecret = Deno.env.get(cronSecretEnvName);
    if (cronSecret && token === cronSecret) return true;
  }

  return false;
}

/**
 * Valida um JWT real de usuário e confirma que ele é administrador,
 * checando tanto `user_roles` quanto `admin_members`.
 */
export async function verifyAdminJwt(req: Request): Promise<AuthResult> {
  const token = extractBearer(req);
  if (!token) {
    return { ok: false, status: 401, reason: 'missing_bearer_token' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { ok: false, status: 500, reason: 'auth_env_not_configured' };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    return { ok: false, status: 401, reason: 'invalid_jwt' };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: roleRow } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (roleRow) return { ok: true, userId: user.id };

  const { data: memberRow } = await adminClient
    .from('admin_members')
    .select('role, is_active')
    .eq('user_id', user.id)
    .in('role', ADMIN_MEMBER_ROLES)
    .eq('is_active', true)
    .maybeSingle();

  if (memberRow) return { ok: true, userId: user.id };

  return { ok: false, status: 403, reason: 'not_admin' };
}

/**
 * Guard principal: aceita service_role / cron secret OU um JWT de admin válido.
 * Retorna `{ ok: false }` sempre que nenhuma das duas condições for satisfeita.
 */
export async function requireAdminOrService(
  req: Request,
  cronSecretEnvName?: string,
): Promise<AuthResult> {
  if (isServiceOrCronRequest(req, cronSecretEnvName)) {
    return { ok: true, isService: true };
  }
  return await verifyAdminJwt(req);
}

/**
 * Constrói a resposta 401/403 padronizada para uma falha de autenticação.
 */
export function authErrorResponse(
  result: AuthResult,
  corsHeaders: Record<string, string>,
  scope?: string,
): Response {
  const status = result.status ?? 401;
  if (scope) {
    console.warn(`[${scope}] auth rejected: ${result.reason ?? 'unauthorized'}`);
  }
  const message = status === 403
    ? 'Acesso negado: apenas administradores'
    : 'Não autorizado';

  return new Response(
    JSON.stringify({ ok: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
