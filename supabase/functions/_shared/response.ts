/**
 * Respostas padronizadas para Edge Functions.
 * Formato: { ok, data?, error?, hint? } conforme EDGE_FUNCTIONS_GUIDE.md
 */

export type SuccessBody = { ok: true; data: unknown };
export type ErrorBody = { ok: false; error: string; hint?: string };

function jsonHeaders(corsHeaders: Record<string, string>): Record<string, string> {
  return { ...corsHeaders, "Content-Type": "application/json" };
}

/** Resposta de sucesso: { ok: true, data } */
export function successResponse(
  data: unknown,
  corsHeaders: Record<string, string>,
  status = 200
): Response {
  const body: SuccessBody = { ok: true, data };
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders(corsHeaders),
  });
}

/** Resposta de erro: { ok: false, error, hint? } */
export function errorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
  hint?: string
): Response {
  const body: ErrorBody = { ok: false, error: message, ...(hint ? { hint } : {}) };
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders(corsHeaders),
  });
}
