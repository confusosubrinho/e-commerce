import { describe, it, expect, vi } from 'vitest';

// Mock SocialLink interface
interface SocialLink {
  id: string;
  name: string;
  url: string;
  icon_type: 'default' | 'custom';
  icon_image_url: string | null;
  sort_order: number;
  is_active: boolean;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

const createMockSupabase = (delay = 10) => {
  let callCount = 0;

  const from = vi.fn().mockReturnThis();
  const update = vi.fn().mockImplementation(() => {
    callCount++;
    return {
      eq: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return { error: null };
      })
    };
  });

  const upsert = vi.fn().mockImplementation(async (data) => {
    callCount++;
    await new Promise(resolve => setTimeout(resolve, delay));
    return { error: null };
  });

  const supabase = {
    from: (table: string) => ({
      update: update,
      upsert: upsert,
    }),
    getCallCount: () => callCount,
    resetCallCount: () => { callCount = 0; }
  };

  return supabase;
};

async function currentApproach(reordered: SocialLink[], supabase: any) {
  const updates = reordered.map((item, idx) =>
    supabase.from('social_links').update({ sort_order: idx + 1 }).eq('id', item.id)
  );
  await Promise.all(updates);
}

async function optimizedApproach(reordered: SocialLink[], supabase: any) {
  const updates = reordered.map((item, idx) => ({
    ...item,
    sort_order: idx + 1
  }));
  await supabase.from('social_links').upsert(updates);
}

describe('Reorder Optimization Benchmark', () => {
  const sampleLinks: SocialLink[] = Array.from({ length: 10 }, (_, i) => ({
    id: `id-${i}`,
    name: `Platform ${i}`,
    url: `https://example.com/${i}`,
    icon_type: 'default',
    icon_image_url: null,
    sort_order: i,
    is_active: true,
    tenant_id: 'tenant-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  it('measures current approach performance', async () => {
    const supabase = createMockSupabase(50); // 50ms delay per DB call
    const start = Date.now();
    await currentApproach(sampleLinks, supabase);
    const duration = Date.now() - start;

    console.log(`Current approach (individual updates) took: ${duration}ms with ${supabase.getCallCount()} DB calls`);

    expect(supabase.getCallCount()).toBe(10);
    // Since it's Promise.all, it should take roughly the time of one call + some overhead,
    // BUT if there are many, some databases or clients might limit concurrency.
    // In our mock, it's truly concurrent so it should be ~50-100ms.
    expect(duration).toBeLessThan(1000);
  });

  it('measures optimized approach performance', async () => {
    const supabase = createMockSupabase(50);
    const start = Date.now();
    await optimizedApproach(sampleLinks, supabase);
    const duration = Date.now() - start;

    console.log(`Optimized approach (bulk upsert) took: ${duration}ms with ${supabase.getCallCount()} DB calls`);

    expect(supabase.getCallCount()).toBe(1);
    expect(duration).toBeLessThan(100);
  });
});
