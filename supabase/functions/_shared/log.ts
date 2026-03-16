/**
 * Log estruturado para Edge Functions.
 * Inclui correlation_id em todos os logs; nunca logar dados pessoais (email, telefone, endereço).
 * Ver OBSERVABILITY.md e EDGE_FUNCTIONS_GUIDE.md.
 */

export type LogContext = Record<string, unknown>;

function sanitize(context: LogContext): LogContext {
  const forbidden = ["email", "customer_email", "phone", "customer_phone", "address", "shipping_address", "card", "cvv"];
  const out: LogContext = {};
  for (const [k, v] of Object.entries(context)) {
    const keyLower = k.toLowerCase();
    if (forbidden.some((f) => keyLower.includes(f))) continue;
    out[k] = v;
  }
  return out;
}

/** Log de erro com correlation_id e contexto (PII filtrado) */
export function logError(
  scope: string,
  correlationId: string,
  error: unknown,
  context?: LogContext
): void {
  const message = error instanceof Error ? error.message : String(error);
  const payload = {
    level: "error",
    scope,
    correlation_id: correlationId,
    error: message,
    ...(context ? sanitize(context) : {}),
  };
  console.error(JSON.stringify(payload));
}

/** Log de fluxo normal (eventos, não PII) */
export function logInfo(
  scope: string,
  correlationId: string,
  message: string,
  context?: LogContext
): void {
  const payload = {
    level: "info",
    scope,
    correlation_id: correlationId,
    message,
    ...(context ? sanitize(context) : {}),
  };
  console.log(JSON.stringify(payload));
}
