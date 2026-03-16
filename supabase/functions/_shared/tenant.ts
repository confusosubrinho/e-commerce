/**
 * Fase 7/8 – Multi-tenant: helper para Edge Functions obterem tenant_id da requisição.
 * O frontend envia x-tenant-id (header) ou body.tenant_id; caso contrário usa tenant padrão.
 * Ver docs/MULTITENANT_DESIGN.md.
 */

export const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}

/**
 * Obtém tenant_id da requisição: header x-tenant-id, ou body.tenant_id, ou tenant padrão.
 * Não valida existência do tenant na tabela (evita round-trip em toda request).
 * @param req - Request da Edge Function
 * @param body - Body já parseado (opcional); se não passado, não lê body.tenant_id
 * @returns UUID do tenant (sempre válido; default se ausente/inválido)
 */
export function getTenantIdFromRequest(
  req: Request,
  body?: Record<string, unknown> | null
): string {
  const fromHeader = req.headers.get("x-tenant-id")?.trim();
  if (fromHeader && isValidUuid(fromHeader)) return fromHeader;

  if (body && typeof body.tenant_id === "string" && isValidUuid(body.tenant_id)) {
    return body.tenant_id;
  }

  return DEFAULT_TENANT_ID;
}
