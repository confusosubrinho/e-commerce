

## Bling Integration — Round 4 Audit: SaaS-Level Improvements

### Bug 1 (Critical): Callback URL mismatch — OAuth will fail

In `src/pages/admin/Integrations.tsx` line 1681, the callback URL displayed to the admin is:
```
${VITE_SUPABASE_URL}/functions/v1/bling/oauth
```
But the actual edge function is deployed at `bling-oauth` (flat naming), so the correct URL should be:
```
${VITE_SUPABASE_URL}/functions/v1/bling-oauth
```
The `bling-oauth` function itself (line 125) correctly builds the callback URL using the right path. However, the admin UI shows the wrong URL, so if the admin copies it to the Bling developer portal, the OAuth redirect will fail with a 404.

**Fix**: Change line 1681 to use `bling-oauth` instead of `bling/oauth`.

---

### Bug 2 (Medium): `bling-oauth` has no auth check on `get_auth_url` and `refresh_token`

The `bling-oauth` function accepts POST actions (`get_auth_url`, `refresh_token`, `check_status`) without verifying the caller is an admin. Anyone with the function URL can request auth URLs or refresh tokens. The callback path (GET with `code`) is correctly public (needed for OAuth redirect), but the POST actions should require admin auth.

**Fix**: Add admin JWT validation for POST requests (same pattern used in `bling-sync` and `bling-sync-single-stock`).

---

### Bug 3 (Medium): `bling-oauth` `refresh_token` action doesn't use optimistic locking

The `refresh_token` action in `bling-oauth` (lines 137-190) reads the refresh token, exchanges it, and saves the new one without checking if another process already consumed the old refresh token. This can invalidate a valid token if called concurrently.

**Fix**: Use the shared `getValidTokenSafe` from `blingTokenRefresh.ts` instead of duplicating token refresh logic.

---

### Bug 4 (Medium): `batchStockSync` in `bling-webhook` doesn't check recent local movements

The cron-based `batchStockSync` (lines 420-563) updates stock for all active variants without checking `hasRecentLocalMovements`. While the webhook path (`updateStockForBlingId` and `syncStockOnly`) correctly checks for recent movements, the cron path blindly overwrites, potentially undoing a recent sale before the Bling order is created.

**Fix**: Add `hasRecentLocalMovements` check in the cron batch loop before updating each variant's stock.

---

### Bug 5 (Medium): `syncStock` manual action also lacks recent movement protection

The `syncStock` function (lines 737-785) called via `action: "sync_stock"` from the admin panel also updates stock without checking for recent local movements.

**Fix**: Add the same `hasRecentLocalMovements` check before updating each variant.

---

### Bug 6 (Low): `order_to_nfe` action duplicates order creation without checking existing bling_order_id

Line 1060: `case "order_to_nfe"` calls `createOrder` directly without using the duplicate check that exists in the `create_order` case (lines 1042-1057). If the order was already sent to Bling, it will create a duplicate order.

**Fix**: Reuse the same duplicate check logic from the `create_order` case.

---

### Bug 7 (Low): `bling-webhook` `syncStockOnly` no-variation path doesn't check recent movements

In `syncStockOnly` lines 401-407, the else branch (no variations) updates all variants for the product without checking `hasRecentLocalMovements`, unlike the variation branch above it.

**Fix**: Add the `hasRecentLocalMovements` check before updating stock in the no-variation path.

---

### Improvement 1: Error retry for failed webhook events

Failed webhook events (`status: "failed"` in `bling_webhook_events`) are never retried. A SaaS-level integration should have automatic retry logic — the cron job can pick up failed events and reprocess them (up to 3 retries).

**Fix**: In `batchStockSync`, after the stock sync, query `bling_webhook_events` with `status = 'failed'` and `retries < 3`, and reprocess them. Increment `retries` on each attempt.

---

### Improvement 2: Disconnect Bling action missing

The admin panel has no way to disconnect from Bling (clear tokens). If the admin wants to reconnect with a different account or revoke access, they have no option.

**Fix**: Add a "Desconectar Bling" button that clears `bling_access_token`, `bling_refresh_token`, and `bling_token_expires_at` from `store_settings`.

---

### Improvement 3: Token health indicator in admin panel

The admin UI shows "Bling conectado e funcionando" but doesn't check if the token is actually valid or expired. The `check_status` action exists but returns `expired: true/false` which isn't displayed.

**Fix**: Use `check_status` to show token health in the connection status bar, with an automatic refresh button if expired.

---

### Files to Modify

1. **`src/pages/admin/Integrations.tsx`** — Fix callback URL (line 1681); add disconnect button; add token health indicator
2. **`supabase/functions/bling-oauth/index.ts`** — Add admin auth for POST actions; use shared token refresh
3. **`supabase/functions/bling-webhook/index.ts`** — Add recent movement check in `batchStockSync` and `syncStockOnly` no-variation path; add failed event retry
4. **`supabase/functions/bling-sync/index.ts`** — Add recent movement check in `syncStock`; fix `order_to_nfe` duplicate check

### Deploy
Redeploy: `bling-oauth`, `bling-webhook`, `bling-sync`

