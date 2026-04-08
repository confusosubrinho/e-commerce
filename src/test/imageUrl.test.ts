import { describe, expect, it } from 'vitest';
import { normalizeSupabaseMediaUrl, resolveImageUrl } from '@/lib/imageUrl';

describe('imageUrl normalization', () => {
  it('converte URL signed do Supabase para public e normaliza path codificado', () => {
    const input = 'https://demo.supabase.co/storage/v1/object/sign/product-media/videos%2Fclip%201.mp4?token=abc';
    const normalized = normalizeSupabaseMediaUrl(input);
    expect(normalized).toBe('https://demo.supabase.co/storage/v1/object/public/product-media/videos/clip%201.mp4');
  });

  it('remove query de assinatura expirada em URL public', () => {
    const input = 'https://demo.supabase.co/storage/v1/object/public/product-media/thumbs/a.webp?X-Amz-Signature=abc&X-Amz-Date=20260101';
    const normalized = normalizeSupabaseMediaUrl(input);
    expect(normalized).toBe('https://demo.supabase.co/storage/v1/object/public/product-media/thumbs/a.webp');
  });

  it('resolveImageUrl retorna placeholder para vazio', () => {
    expect(resolveImageUrl('')).toBe('/placeholder.svg');
  });
});
