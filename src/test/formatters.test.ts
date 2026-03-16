/**
 * Testes unitários para src/lib/formatters.ts
 */
import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  formatCurrency,
  formatDate,
  formatDateTime,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_BADGE_COLORS,
  ORDER_STATUS_CHART_COLORS,
  getProviderLabel,
} from '@/lib/formatters';

describe('formatters', () => {
  describe('formatPrice / formatCurrency', () => {
    it('formata número em BRL', () => {
      // Intl pode usar espaço normal ou U+00A0 (NBSP) dependendo do ambiente
      expect(formatPrice(0)).toMatch(/R\$\s*0,00/);
      expect(formatPrice(99.9)).toMatch(/R\$\s*99,90/);
      expect(formatPrice(1234.56)).toMatch(/R\$\s*1\.234,56/);
    });

    it('formatCurrency é alias de formatPrice', () => {
      expect(formatCurrency(100)).toBe(formatPrice(100));
    });
  });

  describe('formatDate', () => {
    it('formata ISO date em pt-BR', () => {
      const iso = '2025-03-15';
      expect(formatDate(iso)).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });

  describe('formatDateTime', () => {
    it('formata ISO datetime com hora em pt-BR', () => {
      const iso = '2025-03-15T14:30:00Z';
      const out = formatDateTime(iso);
      expect(out).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(out).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('ORDER_STATUS_LABELS', () => {
    it('contém labels para status principais', () => {
      expect(ORDER_STATUS_LABELS.pending).toBe('Pendente');
      expect(ORDER_STATUS_LABELS.paid).toBe('Pago');
      expect(ORDER_STATUS_LABELS.cancelled).toBe('Cancelado');
      expect(ORDER_STATUS_LABELS.refunded).toBe('Reembolsado');
      expect(ORDER_STATUS_LABELS.failed).toBe('Falhou');
    });
  });

  describe('ORDER_STATUS_BADGE_COLORS', () => {
    it('contém classes Tailwind para cada status', () => {
      expect(ORDER_STATUS_BADGE_COLORS.pending).toContain('bg-');
      expect(ORDER_STATUS_BADGE_COLORS.paid).toContain('bg-');
    });
  });

  describe('ORDER_STATUS_CHART_COLORS', () => {
    it('contém hex para cada status', () => {
      expect(ORDER_STATUS_CHART_COLORS.pending).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(ORDER_STATUS_CHART_COLORS.paid).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('getProviderLabel', () => {
    it('retorna label para stripe, appmax, yampi', () => {
      expect(getProviderLabel('stripe')).toBe('Stripe');
      expect(getProviderLabel('appmax')).toBe('Appmax');
      expect(getProviderLabel('yampi')).toBe('Yampi');
    });

    it('retorna "Site" para null, undefined ou desconhecido', () => {
      expect(getProviderLabel(null)).toBe('Site');
      expect(getProviderLabel(undefined)).toBe('Site');
      expect(getProviderLabel('outro')).toBe('Site');
    });
  });
});
