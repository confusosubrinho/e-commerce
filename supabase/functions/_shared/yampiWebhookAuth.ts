const encoder = new TextEncoder();

function normalizeBase64(input: string | null | undefined): string {
  return String(input || "").trim();
}

function timingSafeEqualString(a: string, b: string): boolean {
  const aa = encoder.encode(a);
  const bb = encoder.encode(b);
  const len = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;

  for (let i = 0; i < len; i++) {
    diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  }

  return diff === 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function computeYampiHmacBase64(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  return bytesToBase64(new Uint8Array(signature));
}

export async function isValidYampiWebhookAuth(params: {
  secret: string;
  rawBody: string;
  queryToken?: string | null;
  headerHmac?: string | null;
}): Promise<{ valid: boolean; used: "token" | "hmac" | null }> {
  // Prefer official HMAC validation when header exists; keep token as legacy fallback.
  const incomingHmac = normalizeBase64(params.headerHmac);
  if (incomingHmac && params.secret) {
    const expectedHmac = await computeYampiHmacBase64(params.rawBody, params.secret);
    if (timingSafeEqualString(incomingHmac, expectedHmac)) {
      return { valid: true, used: "hmac" };
    }
  }

  const expectedToken = normalizeBase64(params.secret);
  const incomingToken = normalizeBase64(params.queryToken);
  if (incomingToken && expectedToken && timingSafeEqualString(incomingToken, expectedToken)) {
    return { valid: true, used: "token" };
  }

  return { valid: false, used: null };
}
