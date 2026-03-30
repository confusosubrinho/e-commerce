import { describe, expect, it } from 'vitest';
import { resolveLifecycleTransition } from '../../supabase/functions/_shared/abandonedCart';

describe('abandoned cart lifecycle transitions', () => {
  it('permite active -> abandoned -> expired', () => {
    const a = resolveLifecycleTransition({ current: 'active', target: 'abandoned', nowIso: '2026-03-30T10:00:00.000Z' });
    expect(a?.operational_status).toBe('abandoned');

    const e = resolveLifecycleTransition({ current: 'abandoned', target: 'expired', nowIso: '2026-03-31T10:00:00.000Z' });
    expect(e?.operational_status).toBe('expired');
  });

  it('permite abandoned -> converted e bloqueia regressão de converted', () => {
    const c = resolveLifecycleTransition({ current: 'abandoned', target: 'converted' });
    expect(c?.operational_status).toBe('converted');

    const invalid = resolveLifecycleTransition({ current: 'converted', target: 'abandoned' });
    expect(invalid).toBeNull();
  });
});
