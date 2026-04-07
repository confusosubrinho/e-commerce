const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseRequestedTenantId(
  req: Request,
  body?: Record<string, unknown> | null,
): string | null {
  const fromHeader = req.headers.get("x-tenant-id")?.trim() ?? "";
  if (UUID_REGEX.test(fromHeader)) return fromHeader;

  const fromBody = typeof body?.tenant_id === "string" ? body.tenant_id.trim() : "";
  if (UUID_REGEX.test(fromBody)) return fromBody;

  return null;
}

export interface ResolveAdminTenantResult {
  tenantId: string;
  isSuperAdmin: boolean;
}

/**
 * Resolve o tenant operacional para funções admin Bling.
 * Prioridade:
 * 1) tenant solicitado (x-tenant-id/body.tenant_id), se autorizado
 * 2) tenant único em admin_members ativo
 * 3) fallback user_tenants
 */
export async function resolveAdminTenantContext(
  supabase: any,
  userId: string,
  requestedTenantId?: string | null,
): Promise<ResolveAdminTenantResult> {
  // user_roles usa enum legado app_role ('admin' | 'user'); 'admin' aqui é permissão global.
  const { data: globalAdminRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  const { data: memberRows } = await supabase
    .from("admin_members")
    .select("tenant_id, role, is_active")
    .eq("user_id", userId)
    .eq("is_active", true);

  const members = (memberRows || []).filter((m: any) => typeof m?.tenant_id === "string");
  const memberTenantIds = new Set<string>(members.map((m: any) => m.tenant_id as string));
  const isSuperAdmin =
    !!globalAdminRole ||
    members.some((m: any) => m.role === "super_admin" || m.role === "owner");

  if (requestedTenantId) {
    if (isSuperAdmin || memberTenantIds.has(requestedTenantId)) {
      return { tenantId: requestedTenantId, isSuperAdmin };
    }

    const { data: utRequested } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .eq("user_id", userId)
      .eq("tenant_id", requestedTenantId)
      .maybeSingle();
    if (utRequested?.tenant_id) return { tenantId: utRequested.tenant_id, isSuperAdmin };
    throw new Error("Acesso negado ao tenant solicitado");
  }

  if (members.length === 1) {
    return { tenantId: members[0].tenant_id as string, isSuperAdmin };
  }

  if (members.length > 1) {
    throw new Error("tenant_id é obrigatório para usuários com múltiplos tenants ativos");
  }

  const { data: utRows } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(2);
  const tenantRows = (utRows || []).filter((r: any) => typeof r?.tenant_id === "string");
  if (tenantRows.length === 1) return { tenantId: tenantRows[0].tenant_id as string, isSuperAdmin };
  if (tenantRows.length > 1) {
    throw new Error("tenant_id é obrigatório para usuários com múltiplos tenants");
  }

  throw new Error("Tenant do usuário não encontrado");
}
