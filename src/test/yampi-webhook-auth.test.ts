import { describe, expect, it } from 'vitest';
import { computeYampiHmacBase64, isValidYampiWebhookAuth } from '../../supabase/functions/_shared/yampiWebhookAuth';

describe('yampi webhook auth', () => {
  it('aceita token legado para compatibilidade', async () => {
    const result = await isValidYampiWebhookAuth({
      secret: 'segredo-webhook',
      rawBody: '{"event":"payment.approved"}',
      queryToken: 'segredo-webhook',
      headerHmac: null,
    });

    expect(result.valid).toBe(true);
    expect(result.used).toBe('token');
  });

  it('aceita assinatura hmac oficial da yampi', async () => {
    const rawBody = '{"event":"payment.approved","resource":{"id":123}}';
    const secret = 'segredo-webhook';
    const hmac = await computeYampiHmacBase64(rawBody, secret);

    const result = await isValidYampiWebhookAuth({
      secret,
      rawBody,
      queryToken: null,
      headerHmac: hmac,
    });

    expect(result.valid).toBe(true);
    expect(result.used).toBe('hmac');
  });

  it('rejeita assinatura inválida', async () => {
    const result = await isValidYampiWebhookAuth({
      secret: 'segredo-webhook',
      rawBody: '{"event":"payment.approved"}',
      queryToken: null,
      headerHmac: 'assinatura-invalida',
    });

    expect(result.valid).toBe(false);
    expect(result.used).toBeNull();
  });

  it('prefere hmac quando hmac e token estão presentes', async () => {
    const rawBody = '{"event":"payment.approved","resource":{"id":999}}';
    const secret = 'segredo-webhook';
    const hmac = await computeYampiHmacBase64(rawBody, secret);

    const result = await isValidYampiWebhookAuth({
      secret,
      rawBody,
      queryToken: 'segredo-webhook',
      headerHmac: hmac,
    });

    expect(result.valid).toBe(true);
    expect(result.used).toBe('hmac');
  });
});
