import { describe, expect, it } from 'vitest';
import { getYampiRateLimitMeta } from '../../supabase/functions/_shared/yampiRateLimit';

describe('yampi rate limit headers', () => {
  it('lê headers x-ratelimit-limit e x-ratelimit-remaining', () => {
    const res = new Response('{}', {
      status: 200,
      headers: {
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '12',
      },
    });

    const meta = getYampiRateLimitMeta(res);
    expect(meta.limit).toBe(60);
    expect(meta.remaining).toBe(12);
  });
});
