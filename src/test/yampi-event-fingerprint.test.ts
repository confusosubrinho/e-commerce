import { describe, expect, it } from 'vitest';
import { buildStableWebhookFingerprint } from '../../supabase/functions/_shared/yampiEventFingerprint';

describe('yampi event fingerprint', () => {
  it('gera fingerprint determinístico com ids estáveis', async () => {
    const fp1 = await buildStableWebhookFingerprint({
      eventType: 'approved',
      yampiOrderId: '123',
      transactionId: 'tx-1',
      sessionId: 'sess-1',
      rawBody: '{"a":1}',
    });
    const fp2 = await buildStableWebhookFingerprint({
      eventType: 'approved',
      yampiOrderId: '123',
      transactionId: 'tx-1',
      sessionId: 'sess-1',
      rawBody: '{"a":2}',
    });

    expect(fp1.ok).toBe(true);
    expect(fp1.fingerprint).toBe(fp2.fingerprint);
  });

  it('quando faltam identificadores marca fingerprint fraco porém determinístico', async () => {
    const raw = '{"resource":{"x":1},"event":"payment.approved"}';
    const fp1 = await buildStableWebhookFingerprint({ eventType: 'approved', rawBody: raw });
    const fp2 = await buildStableWebhookFingerprint({ eventType: 'approved', rawBody: raw });

    expect(fp1.ok).toBe(false);
    expect(fp1.fingerprint).toBe(fp2.fingerprint);
  });
});
