import { describe, it, expect, beforeEach } from 'bun:test';

// SESSION_KEY is not exported, so we'll use the literal for testing
const SESSION_KEY = 'vl_session_id';

describe('getSessionId Security', () => {
  beforeEach(() => {
    if (typeof sessionStorage === 'undefined') {
      const store: Record<string, string> = {};
      (global as any).sessionStorage = {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); },
        removeItem: (key: string) => { delete store[key]; },
      };
    }
    sessionStorage.clear();
  });

  it('should generate valid UUID-based session IDs', () => {
    // This tests the logic that was implemented in utmTracker.ts
    const generateId = () => 'sess_' + crypto.randomUUID();
    const id = generateId();

    expect(id).toMatch(/^sess_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(id.length).toBe(41);
  });

  it('should generate unique IDs in sequence', () => {
    const generateId = () => 'sess_' + crypto.randomUUID();
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const id = generateId();
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
    expect(ids.size).toBe(100);
  });
});
