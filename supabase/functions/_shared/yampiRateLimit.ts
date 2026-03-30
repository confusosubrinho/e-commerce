import { fetchWithTimeout } from "./fetchWithTimeout.ts";

export type YampiRateLimitMeta = {
  limit: number | null;
  remaining: number | null;
};

function toNumber(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getRetryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  const retrySeconds = retryAfter ? Number(retryAfter) : null;
  if (retrySeconds && Number.isFinite(retrySeconds) && retrySeconds > 0) {
    return Math.ceil(retrySeconds * 1000);
  }
  return Math.min(8000, 500 * (2 ** attempt));
}

export function getYampiRateLimitMeta(response: Response): YampiRateLimitMeta {
  return {
    limit: toNumber(response.headers.get("x-ratelimit-limit")),
    remaining: toNumber(response.headers.get("x-ratelimit-remaining")),
  };
}

export async function fetchYampiWithRateLimit(
  input: string,
  init: RequestInit,
  opts?: { timeoutMs?: number; maxRetries?: number; scope?: string; requestId?: string | null },
): Promise<Response> {
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const maxRetries = opts?.maxRetries ?? 2;
  const scope = opts?.scope ?? "yampi-client";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetchWithTimeout(input, init, timeoutMs);
    const rl = getYampiRateLimitMeta(response);

    console.log(JSON.stringify({
      scope,
      request_id: opts?.requestId ?? null,
      yampi_rate_limit: rl.limit,
      yampi_rate_remaining: rl.remaining,
      http_status: response.status,
      attempt,
      url: input,
    }));

    if (response.status !== 429) {
      if ((rl.remaining ?? 1) <= 1 && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      return response;
    }

    if (attempt >= maxRetries) return response;

    const delayMs = getRetryDelayMs(response, attempt);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  // unreachable
  return fetchWithTimeout(input, init, timeoutMs);
}
