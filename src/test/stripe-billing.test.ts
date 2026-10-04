import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

type EventPayload = { type: string; data: { object: Record<string, unknown> }; id: string };

function billingHandler(event: EventPayload) {
  let handler: (req: Request) => Promise<Response> = async () => new Response(null, { status: 500 });
  const update = vi.fn();
  const from = vi.fn((table: string) => {
    const result = { data: table === 'tenant_plans' ? [{ id: 'pro-plan' }] : null, error: null };
    const chain = {
      select: () => chain, eq: () => chain, or: () => chain, limit: () => chain,
      maybeSingle: async () => ({ data: table === 'tenant_plans' ? { id: 'free-plan' } : null, error: null }),
      insert: async () => ({ error: null }),
      update: (payload: unknown) => { update(table, payload); return chain; },
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return chain;
  });
  class StripeMock {
    webhooks = { constructEventAsync: async () => event };
  }
  const modules: Record<string, unknown> = {
    'https://esm.sh/@supabase/supabase-js@2': { createClient: () => ({ from }) },
    'https://esm.sh/stripe@18.5.0': { default: StripeMock },
    '../_shared/cors.ts': { getCorsHeaders: () => ({}) },
    '../_shared/response.ts': {
      successResponse: (data: unknown) => Response.json(data),
      errorResponse: (error: string, status: number) => Response.json({ error }, { status }),
    },
    '../_shared/log.ts': { logInfo: vi.fn(), logError: vi.fn() },
  };
  const source = readFileSync('supabase/functions/checkout-stripe-webhook/index.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', 'Deno', compiled)(
    (name: string) => { if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`); return modules[name]; },
    {},
    { env: { get: () => 'test-secret' }, serve: (callback: typeof handler) => { handler = callback; } },
  );
  return { run: (signature = 'test-signature') => handler(new Request('https://test.local/webhook', { method: 'POST', headers: signature ? { 'stripe-signature': signature } : {}, body: '{}' })), from, update };
}

describe('Stripe Billing preservado', () => {
  it('atualiza a assinatura da plataforma sem pedidos ou estoque', async () => {
    const { run, from, update } = billingHandler({ id: 'evt-sub', type: 'customer.subscription.updated', data: { object: { id: 'sub-1', customer: 'cus-1', metadata: { tenant_id: 'tenant-1' }, status: 'active', items: { data: [{ price: { id: 'price-1' } }] } } } });
    expect((await run()).status).toBe(200);
    expect(update).toHaveBeenCalledWith('tenants', expect.objectContaining({ stripe_subscription_id: 'sub-1', billing_status: 'active', plan_id: 'pro-plan' }));
    expect(from.mock.calls.map(([table]) => table)).not.toContain('orders');
    expect(from.mock.calls.map(([table]) => table)).not.toContain('product_variants');
  });
  it('preserva o cancelamento de assinatura', async () => {
    const { run, update } = billingHandler({ id: 'evt-delete', type: 'customer.subscription.deleted', data: { object: { id: 'sub-1', customer: 'cus-1', metadata: { tenant_id: 'tenant-1' } } } });
    await run();
    expect(update).toHaveBeenCalledWith('tenants', expect.objectContaining({ stripe_subscription_id: null, billing_status: 'canceled', plan_id: 'free-plan' }));
  });
  it('ignora pagamentos antigos sem gravar dados comerciais', async () => {
    const { run, from } = billingHandler({ id: 'evt-payment', type: 'payment_intent.succeeded', data: { object: { id: 'pi-1' } } });
    expect(await (await run()).json()).toEqual({ received: true, skipped: true });
    expect(from).not.toHaveBeenCalled();
  });
  it('mantém a assinatura obrigatória do webhook', async () => {
    const { run, from } = billingHandler({ id: 'evt-sub', type: 'customer.subscription.updated', data: { object: {} } });
    expect((await run('')).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});
