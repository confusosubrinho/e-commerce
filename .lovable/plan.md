

## Yampi Integration — Additional Bugs & Improvements

### Bug 1 (Critical): `yampi-sync-order-status` still missing from `config.toml`

The previous audit identified this but it was never applied. The function is not in `config.toml`, so the Supabase gateway enforces default JWT validation before the function code runs. Since the function does its own JWT auth internally via `supabase.auth.getUser(token)`, the gateway's built-in check can reject valid user JWTs that don't match Supabase's internal format expectations, causing intermittent 401 errors when admins try to sync order status from the UI.

**Fix**: Add `[functions.yampi-sync-order-status]` with `verify_jwt = false` to `config.toml`.

### Bug 2 (Medium): Webhook cancelled event doesn't check `checkout_session_id` fallback

When a cancellation webhook fires, the code only searches by `external_reference` (lines 449-460 of `yampi-webhook`). If the order was pre-created by `checkout-router` but the webhook fires before the approved event sets `external_reference`, the order won't be found and stock won't be restored.

**Fix**: Add a fallback lookup by `checkout_session_id` when `external_reference` lookup returns null, similar to what the approved event handler already does.

### Bug 3 (Medium): Shipped/delivered events don't check `checkout_session_id` fallback

Same issue as Bug 2 — the shipped (line 412-425) and delivered (line 430-444) handlers only look up by `external_reference`. Pre-created orders may not have `external_reference` set yet.

**Fix**: Add `checkout_session_id` fallback for shipped and delivered lookups.

### Bug 4 (Medium): `checkout-create-session` for Yampi doesn't pass `success_url` to payment link

The `checkout-create-session` function creates a Yampi payment link (lines 270-310) but never passes `success_url` or `return_url` in the payload. The Yampi API supports a `redirect_url` field on payment links. Without it, the user may land on a Yampi default thank-you page instead of returning to the store.

**Fix**: Include `redirect_url` (or `return_url`) in the payment link creation payload, using the `success_url` from the router or a sensible default.

### Bug 5 (Low): `yampi-sync-sku` doesn't include `quantity_managed` in PUT

The `yampi-sync-sku` function (line 64-68) sends `quantity` in the PUT body but doesn't set `quantity_managed: true`. If the SKU was previously set to unmanaged quantity on Yampi, the stock value is ignored.

**Fix**: Add `quantity_managed: true` to the PUT payload.

### Bug 6 (Low): Webhook order event hash / idempotency missing

The webhook doesn't record event hashes in `order_events` table to prevent reprocessing duplicate webhook deliveries. If Yampi retries a webhook, the entire order creation flow runs again. The `external_reference` check catches some duplicates, but there's a race window.

**Fix**: Insert an `order_events` record with a hash of the event payload at the start of processing, and skip if the hash already exists.

### Improvement 1: Webhook should update order `total_amount` on shipped events

When Yampi sends a shipped event, it often includes final shipping costs and tracking info. Currently only `status` and `tracking_code` are updated. The webhook should also update `shipping_cost` if present.

**Fix**: Extract `shipping_cost` from shipped event data and update the order.

### Improvement 2: `yampi-import-order` should accept batch import

Currently only supports importing one order at a time. For stores migrating from Yampi, importing orders one-by-one is tedious.

**Fix**: Accept an optional `yampi_order_ids` array parameter for batch import, processing up to 10 orders per request.

### Files to Modify

1. **`supabase/config.toml`** — Add `yampi-sync-order-status` entry
2. **`supabase/functions/yampi-webhook/index.ts`** — Add `checkout_session_id` fallback for cancelled/shipped/delivered; add event hash idempotency; update shipping_cost on shipped
3. **`supabase/functions/checkout-create-session/index.ts`** — Pass `redirect_url` to Yampi payment link
4. **`supabase/functions/yampi-sync-sku/index.ts`** — Add `quantity_managed: true` to PUT
5. **`supabase/functions/yampi-import-order/index.ts`** — Support batch import

### Deploy

Redeploy: `yampi-webhook`, `checkout-create-session`, `yampi-sync-sku`, `yampi-import-order`

