/**
 * Testes unitários para funções puras de src/lib/pricingEngine.ts
 */
import { describe, it, expect } from 'vitest';
import type { PricingConfig } from '@/lib/pricingEngine';
import {
  getPixPrice,
  shouldApplyPixDiscount,
  getPixPriceForDisplay,
  getPixDiscountAmount,
  getTransparentCheckoutFee,
  getGatewayCost,
  getInstallmentDisplay,
  calculateInstallments,
} from '@/lib/pricingEngine';

function minimalConfig(overrides: Partial<PricingConfig> = {}): PricingConfig {
  return {
    id: 'test',
    is_active: true,
    max_installments: 6,
    interest_free_installments: 3,
    interest_free_installments_sale: null,
    card_cash_rate: 0,
    pix_discount: 5,
    cash_discount: 0,
    pix_discount_applies_to_sale_products: true,
    interest_mode: 'fixed',
    monthly_rate_fixed: 0,
    monthly_rate_by_installment: {},
    min_installment_value: 25,
    rounding_mode: 'adjust_last',
    transparent_checkout_fee_enabled: false,
    transparent_checkout_fee_percent: 0,
    gateway_fee_1x_percent: 4.99,
    gateway_fee_additional_per_installment_percent: 2.49,
    gateway_fee_starts_at_installment: 2,
    gateway_fee_mode: 'linear_per_installment',
    ...overrides,
  };
}

describe('pricingEngine', () => {
  describe('getPixPrice', () => {
    it('aplica desconto PIX ao preço', () => {
      const config = minimalConfig({ pix_discount: 5 });
      expect(getPixPrice(100, config)).toBe(95);
      expect(getPixPrice(100, minimalConfig({ pix_discount: 10 }))).toBe(90);
    });

    it('com 0% desconto retorna o próprio preço', () => {
      const config = minimalConfig({ pix_discount: 0 });
      expect(getPixPrice(100, config)).toBe(100);
    });
  });

  describe('shouldApplyPixDiscount', () => {
    it('retorna true quando produto não está em promoção', () => {
      const config = minimalConfig();
      expect(shouldApplyPixDiscount(config, false)).toBe(true);
    });

    it('retorna false quando produto em promoção e config desabilita PIX em promoção', () => {
      const config = minimalConfig({ pix_discount_applies_to_sale_products: false });
      expect(shouldApplyPixDiscount(config, true)).toBe(false);
    });

    it('retorna true quando produto em promoção e config permite PIX em promoção', () => {
      const config = minimalConfig({ pix_discount_applies_to_sale_products: true });
      expect(shouldApplyPixDiscount(config, true)).toBe(true);
    });
  });

  describe('getPixPriceForDisplay', () => {
    it('aplica desconto PIX quando permitido', () => {
      const config = minimalConfig({ pix_discount: 5 });
      expect(getPixPriceForDisplay(100, config, false)).toBe(95);
    });

    it('não aplica desconto quando produto em promoção e config desabilita', () => {
      const config = minimalConfig({ pix_discount: 5, pix_discount_applies_to_sale_products: false });
      expect(getPixPriceForDisplay(100, config, true)).toBe(100);
    });
  });

  describe('getPixDiscountAmount', () => {
    it('retorna valor do desconto em BRL', () => {
      const config = minimalConfig({ pix_discount: 5 });
      expect(getPixDiscountAmount(100, config, false)).toBe(5);
    });

    it('retorna 0 quando desconto não se aplica (produto em promoção)', () => {
      const config = minimalConfig({ pix_discount: 5, pix_discount_applies_to_sale_products: false });
      expect(getPixDiscountAmount(100, config, true)).toBe(0);
    });
  });

  describe('getTransparentCheckoutFee', () => {
    it('retorna 0 quando fee desabilitado', () => {
      const config = minimalConfig();
      expect(getTransparentCheckoutFee(100, config)).toBe(0);
    });

    it('calcula percentual quando habilitado', () => {
      const config = minimalConfig({
        transparent_checkout_fee_enabled: true,
        transparent_checkout_fee_percent: 1,
      });
      expect(getTransparentCheckoutFee(100, config)).toBe(1);
    });
  });

  describe('getGatewayCost', () => {
    it('retorna fee para 1x no modo linear', () => {
      const config = minimalConfig({ gateway_fee_1x_percent: 5 });
      const r = getGatewayCost(100, 1, config);
      expect(r.gateway_fee_percent_effective).toBe(5);
      expect(r.gateway_fee_amount).toBe(5);
    });

    it('aumenta fee para mais parcelas no modo linear', () => {
      const config = minimalConfig({
        gateway_fee_1x_percent: 5,
        gateway_fee_additional_per_installment_percent: 1,
        gateway_fee_starts_at_installment: 2,
      });
      const r = getGatewayCost(100, 3, config);
      expect(r.gateway_fee_amount).toBeGreaterThan(5);
    });
  });

  describe('calculateInstallments', () => {
    it('PIX retorna total único sem juros', () => {
      const config = minimalConfig({ pix_discount: 5 });
      const r = calculateInstallments(100, config, 'pix');
      expect(r.total).toBe(95);
      expect(r.hasInterest).toBe(false);
      expect(r.installmentValue).toBe(95);
    });

    it('cartão 1x sem taxa retorna valor único', () => {
      const config = minimalConfig();
      const r = calculateInstallments(100, config, 'card', 1);
      expect(r.total).toBe(100);
      expect(r.hasInterest).toBe(false);
    });

    it('cartão 2x sem juros divide igual', () => {
      const config = minimalConfig();
      const r = calculateInstallments(100, config, 'card', 2);
      expect(r.total).toBe(100);
      expect(r.hasInterest).toBe(false);
      expect(r.installmentValue).toBe(50);
    });
  });

  describe('getInstallmentDisplay', () => {
    it('retorna primaryText e maxInstallments', () => {
      const config = minimalConfig();
      const display = getInstallmentDisplay(100, config);
      expect(display.primaryText).toBeTruthy();
      expect(display.maxInstallments).toBe(6);
    });

    it('quando há parcelas sem juros, primaryText contém "sem juros"', () => {
      const config = minimalConfig();
      const display = getInstallmentDisplay(100, config);
      expect(display.primaryText).toContain('sem juros');
      expect(display.bestInterestFreeInstallments).toBeGreaterThanOrEqual(2);
    });
  });
});
