import { beforeEach, describe, expect, it, vi } from 'vitest';

async function freshTracking() {
  vi.resetModules();
  return await import('@/lib/tracking');
}

describe('tracking', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete window.gtag;
    delete window.fbq;
    delete window.ttq;
    window.dataLayer = undefined;
  });

  it('starts without consent and persists the choice', async () => {
    const t = await freshTracking();
    expect(t.getConsent()).toBeNull();
    const listener = vi.fn();
    window.addEventListener(t.CONSENT_EVENT, listener);
    t.setConsent('accepted');
    expect(t.getConsent()).toBe('accepted');
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(t.CONSENT_EVENT, listener);
  });

  it('loads only trackers with valid ids', async () => {
    const t = await freshTracking();
    const active = t.loadTrackers({
      googleAnalyticsId: 'g-abc1234',
      facebookPixelId: '12345"><script>alert(1)</script>',
      tiktokPixelId: 'C4ABCDEFGHIJ1234',
    });
    expect(active).toBe(true);
    const srcs = Array.from(document.head.querySelectorAll('script')).map((s) => s.src);
    expect(srcs.some((s) => s.includes('googletagmanager.com/gtag/js?id=G-ABC1234'))).toBe(true);
    expect(srcs.some((s) => s.includes('analytics.tiktok.com') && s.includes('sdkid=C4ABCDEFGHIJ1234'))).toBe(true);
    expect(srcs.some((s) => s.includes('connect.facebook.net'))).toBe(false);
    expect(window.fbq).toBeUndefined();
  });

  it('does nothing when no tracker is configured', async () => {
    const t = await freshTracking();
    expect(t.loadTrackers({ googleAnalyticsId: '', facebookPixelId: null })).toBe(false);
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });

  it('injects custom head code and re-creates scripts so they run', async () => {
    const t = await freshTracking();
    t.loadTrackers({ headCode: '<meta name="x-test" content="1"><script data-test="1">window.__ran = true;</script>' });
    expect(document.head.querySelector('meta[name="x-test"]')).not.toBeNull();
    const script = document.head.querySelector('script[data-test="1"]') as HTMLScriptElement;
    expect(script.text).toContain('window.__ran');
  });

  it('queues commerce events until trackers load and flushes after the first page view', async () => {
    const t = await freshTracking();
    t.trackCommerce('view_item', [{ id: '1', name: 'Bota', price: 199.9 }]);
    t.loadTrackers({ googleAnalyticsId: 'G-ABC1234' });
    const before = window.dataLayer!.length;
    t.trackPageView('/produto/bota');
    const events = window.dataLayer!.slice(before).map((args) => Array.from(args as ArrayLike<unknown>)[1]);
    expect(events).toEqual(['page_view', 'view_item']);
  });

  it('drops commerce events when consent was declined', async () => {
    const t = await freshTracking();
    t.setConsent('declined');
    t.trackCommerce('add_to_cart', [{ id: '1', name: 'Bota', price: 100 }]);
    t.loadTrackers({ googleAnalyticsId: 'G-ABC1234' });
    const before = window.dataLayer!.length;
    t.trackPageView('/');
    const events = window.dataLayer!.slice(before).map((args) => Array.from(args as ArrayLike<unknown>)[1]);
    expect(events).toEqual(['page_view']);
  });

  it('extracts numeric ids from Shopify GIDs', async () => {
    const t = await freshTracking();
    expect(t.shopifyNumericId('gid://shopify/Product/12345')).toBe('12345');
  });
});
