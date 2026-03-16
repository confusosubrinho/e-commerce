/**
 * Fase 8 – Testes do módulo de tenant (resolução por domínio/path e isolamento).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_TENANT_ID,
  resolveTenantId,
  getSlugFromPath,
  getTenantIdByDomain,
  getTenantIdBySlug,
  resolveTenantIdAsync,
  MAIN_DOMAIN_ALIASES,
} from '@/lib/tenant';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('tenant', () => {
  describe('DEFAULT_TENANT_ID e resolveTenantId', () => {
    it('DEFAULT_TENANT_ID é o UUID do tenant padrão', () => {
      expect(DEFAULT_TENANT_ID).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('resolveTenantId retorna sempre o tenant padrão (sync)', () => {
      expect(resolveTenantId()).toBe(DEFAULT_TENANT_ID);
    });
  });

  describe('getSlugFromPath', () => {
    it('extrai slug do path /loja/:slug', () => {
      expect(getSlugFromPath('/loja/minha-loja')).toBe('minha-loja');
      expect(getSlugFromPath('/loja/outra/resto')).toBe('outra');
    });

    it('retorna null quando path não é /loja/:slug', () => {
      expect(getSlugFromPath('/')).toBe(null);
      expect(getSlugFromPath('/loja')).toBe(null);
      expect(getSlugFromPath('/produtos')).toBe(null);
      expect(getSlugFromPath('/admin')).toBe(null);
    });
  });

  describe('getTenantIdByDomain', () => {
    it('retorna null quando Supabase não encontra tenant pelo domain', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient;

      const result = await getTenantIdByDomain(mockSupabase, 'unknown.example.com');
      expect(result).toBe(null);
    });

    it('retorna id quando Supabase retorna tenant ativo', async () => {
      const tenantId = '11111111-1111-1111-1111-111111111111';
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: tenantId }, error: null }),
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient;

      const result = await getTenantIdByDomain(mockSupabase, 'loja.example.com');
      expect(result).toBe(tenantId);
    });
  });

  describe('getTenantIdBySlug', () => {
    it('retorna null quando Supabase não encontra tenant pelo slug', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient;

      const result = await getTenantIdBySlug(mockSupabase, 'slug-inexistente');
      expect(result).toBe(null);
    });

    it('retorna id quando Supabase retorna tenant ativo', async () => {
      const tenantId = '22222222-2222-2222-2222-222222222222';
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: tenantId }, error: null }),
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient;

      const result = await getTenantIdBySlug(mockSupabase, 'minha-loja');
      expect(result).toBe(tenantId);
    });
  });

  describe('resolveTenantIdAsync (isolamento por contexto)', () => {
    const originalWindow = global.window;

    beforeEach(() => {
      vi.stubGlobal('window', { location: { hostname: 'localhost', pathname: '/' } });
    });

    afterEach(() => {
      vi.stubGlobal('window', originalWindow);
    });

    it('em localhost sem path /loja/:slug retorna tenant padrão', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient;

      const result = await resolveTenantIdAsync(mockSupabase);
      expect(result).toBe(DEFAULT_TENANT_ID);
    });

    it('em localhost com path /loja/outra retorna tenant quando encontrado por slug', async () => {
      const tenantId = '33333333-3333-3333-3333-333333333333';
      vi.stubGlobal('window', { location: { hostname: 'localhost', pathname: '/loja/outra' } });

      let slugUsed = '';
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn((_col: string, val: string) => {
              slugUsed = val;
              return {
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: tenantId }, error: null }),
                })),
              };
            }),
          })),
        })),
      } as unknown as SupabaseClient;

      const result = await resolveTenantIdAsync(mockSupabase);
      expect(slugUsed).toBe('outra');
      expect(result).toBe(tenantId);
    });

    it('com hostname customizado retorna tenant quando encontrado por domain', async () => {
      const tenantId = '44444444-4444-4444-4444-444444444444';
      vi.stubGlobal('window', { location: { hostname: 'minhaloja.com.br', pathname: '/' } });

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: tenantId }, error: null }),
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient;

      const result = await resolveTenantIdAsync(mockSupabase);
      expect(result).toBe(tenantId);
    });
  });

  describe('MAIN_DOMAIN_ALIASES', () => {
    it('inclui localhost e 127.0.0.1', () => {
      expect(MAIN_DOMAIN_ALIASES).toContain('localhost');
      expect(MAIN_DOMAIN_ALIASES).toContain('127.0.0.1');
    });
  });
});
