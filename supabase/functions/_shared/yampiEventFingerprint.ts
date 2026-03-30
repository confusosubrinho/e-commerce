export type WebhookFingerprintInput = {
  eventType: string;
  yampiOrderId?: string | null;
  transactionId?: string | null;
  sessionId?: string | null;
  paymentLinkId?: string | null;
  status?: string | null;
  rawBody: string;
};

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',')}}`;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function buildStableWebhookFingerprint(input: WebhookFingerprintInput): Promise<{ ok: boolean; fingerprint: string | null; reason?: string }> {
  const stableKeys = [
    input.yampiOrderId ? `order:${input.yampiOrderId}` : null,
    input.transactionId ? `tx:${input.transactionId}` : null,
    input.sessionId ? `session:${input.sessionId}` : null,
    input.paymentLinkId ? `plink:${input.paymentLinkId}` : null,
    input.status ? `status:${String(input.status).toLowerCase()}` : null,
  ].filter(Boolean) as string[];

  if (stableKeys.length === 0) {
    const normalizedBody = stableJson(JSON.parse(input.rawBody || '{}'));
    const bodyHash = await sha256Hex(normalizedBody);
    // still deterministic, but explicitly flagged as weak for observability
    return { ok: false, fingerprint: `${input.eventType}|body:${bodyHash}`, reason: 'MISSING_STABLE_IDENTIFIERS' };
  }

  return {
    ok: true,
    fingerprint: `${input.eventType}|${stableKeys.sort().join('|')}`,
  };
}
