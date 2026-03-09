

# Fix: Site reloading twice on open

## Root Cause

`APP_VERSION` is defined as `import.meta.env.VITE_APP_VERSION || Date.now().toString()`. Since `VITE_APP_VERSION` is not set, every page load generates a **unique timestamp** as the version.

The `VersionChecker` component (runs after 5 seconds) fetches `app_version` from the database. Since the server version will **never** match a random `Date.now()` string, it triggers `window.location.reload()` on every first visit. The `sessionStorage` guard prevents a third reload, but the user still experiences the page loading, rendering partially, then reloading — hence "updating twice."

## Fix

In `VersionChecker.tsx`, skip the reload when `APP_VERSION` is the `Date.now()` fallback (i.e., `VITE_APP_VERSION` is not configured). The version check should only trigger reloads when a real, intentional version string is set.

### `src/components/store/VersionChecker.tsx`

Add an early return at the top of the `check` function:

```typescript
const check = async () => {
  // If no explicit VITE_APP_VERSION is configured, APP_VERSION is a random
  // Date.now() string — comparing it against the server is meaningless and
  // causes a spurious reload on every first visit.
  if (!import.meta.env.VITE_APP_VERSION) return;
  // ... rest of check logic
```

This single line prevents the false-positive version mismatch reload while preserving the mechanism for when a real version is deployed.

## Files Modified
- `src/components/store/VersionChecker.tsx` — skip check when no explicit version is configured

