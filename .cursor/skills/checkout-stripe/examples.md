# Exemplos — Checkout / Stripe (Next.js) + Webhooks (Supabase)

## Exemplo A: Next.js (App Router) criando Checkout Session

### Variáveis de ambiente (server)

```bash
STRIPE_SECRET_KEY=...
NEXT_PUBLIC_SITE_URL=https://localhost:3000
```

### Rota para criar sessão (`app/api/checkout/route.ts`)

```ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: Request) {
  const { lineItems, orderId } = (await request.json()) as {
    orderId: string;
    lineItems: Array<{ price: string; quantity: number }>;
  };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/checkout/cancel`,
    metadata: { orderId },
  });

  return Response.json({ url: session.url });
}
```

### Página de sucesso (`app/checkout/success/page.tsx`)

Use a página para UX e para buscar o estado do pedido no seu banco. Não marque “pago” aqui.

```tsx
export default async function CheckoutSuccessPage() {
  return (
    <main>
      <h1>Pedido recebido</h1>
      <p>
        Estamos confirmando o pagamento. Se você não receber a confirmação em
        alguns minutos, atualize a página.
      </p>
    </main>
  );
}
```

## Exemplo B: Supabase Edge Function (webhook) — comandos úteis

Baseado no exemplo oficial do Supabase para Stripe webhooks:
`https://raw.githubusercontent.com/supabase/supabase/master/examples/edge-functions/supabase/functions/stripe-webhooks/README.md`

### Rodar local (3 terminais)

```bash
supabase functions serve --no-verify-jwt --env-file ./supabase/.env.local
```

```bash
stripe listen --forward-to localhost:54321/functions/v1/
```

```bash
stripe trigger payment_intent.succeeded
```

## Exemplo C: “Loja pronta” (referência de UI/fluxo)

Para ideias de fluxo de storefront (sem copiar tudo):

- `https://github.com/top-web-developer/Nextjs-stripe-checkout`

