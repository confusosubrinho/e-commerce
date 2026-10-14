/**
 * Rastreamento (Google Analytics 4, Meta Pixel, TikTok Pixel e códigos personalizados
 * do admin em Configurações → Código Externo). Nada é carregado sem o consentimento
 * do visitante no aviso de cookies (LGPD).
 */

type ConsentState = 'accepted' | 'declined' | null;

const CONSENT_KEY = 'cookie-consent-v2';
export const CONSENT_EVENT = 'cookie-consent:change';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & Record<string, unknown>;
    _fbq?: unknown;
    ttq?: Record<string, unknown> & { page?: () => void; track?: (...args: unknown[]) => void; load?: (id: string) => void };
    TiktokAnalyticsObject?: string;
  }
}

export function getConsent(): ConsentState {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'accepted' || value === 'declined' ? value : null;
  } catch {
    return null;
  }
}

export function setConsent(value: ConsentState): void {
  const previous = getConsent();
  try {
    if (value) localStorage.setItem(CONSENT_KEY, value);
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Sem storage: a escolha vale só para esta página.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
  // Scripts de terceiros já carregados não podem ser descarregados.
  if (previous === 'accepted' && value === 'declined') window.location.reload();
}

export interface TrackingConfig {
  googleAnalyticsId?: string | null;
  facebookPixelId?: string | null;
  tiktokPixelId?: string | null;
  headCode?: string | null;
  bodyCode?: string | null;
}

const GA_ID = /^(G|AW|GT)-[A-Z0-9]{4,20}$/;
const META_ID = /^\d{6,20}$/;
const TIKTOK_ID = /^[A-Z0-9]{10,30}$/;

export const TRACKING_ID_FORMATS = { googleAnalytics: GA_ID, facebookPixel: META_ID, tiktokPixel: TIKTOK_ID };

let loaded = false;
const pending: Array<() => void> = [];

function loadScript(src: string): void {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/** Insere HTML do admin; scripts precisam ser recriados para executar. */
function injectHtml(target: HTMLElement, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const node of Array.from(template.content.childNodes)) {
    if (node instanceof HTMLScriptElement) {
      const script = document.createElement('script');
      for (const attr of Array.from(node.attributes)) script.setAttribute(attr.name, attr.value);
      script.text = node.text;
      target.appendChild(script);
    } else {
      target.appendChild(document.importNode(node, true));
    }
  }
}

function initGoogle(id: string): void {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id, { send_page_view: false });
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
}

function initMeta(id: string): void {
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      const self = fbq as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] };
      if (self.callMethod) self.callMethod(...args);
      else self.queue.push(args);
    } as Window['fbq'] & { queue: unknown[]; loaded: boolean; version: string; push: unknown };
    fbq!.push = fbq;
    fbq!.loaded = true;
    fbq!.version = '2.0';
    fbq!.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
    loadScript('https://connect.facebook.net/en_US/fbevents.js');
  }
  window.fbq!('init', id);
}

// Porta do snippet oficial do TikTok: a fila é o próprio array `ttq`.
function initTikTok(id: string): void {
  const src = 'https://analytics.tiktok.com/i18n/pixel/events.js';
  window.TiktokAnalyticsObject = 'ttq';
  type Ttq = unknown[] & Record<string, unknown>;
  const ttq = (window.ttq ?? []) as unknown as Ttq;
  const methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
  const setAndDefer = (target: Ttq, method: string) => {
    target[method] = (...args: unknown[]) => { target.push([method, ...args]); };
  };
  ttq.methods = methods;
  ttq.setAndDefer = setAndDefer;
  for (const m of methods) setAndDefer(ttq, m);
  ttq.instance = (instanceId: string) => {
    const instance = ((ttq._i as Record<string, Ttq>)[instanceId] ?? []) as Ttq;
    for (const m of methods) setAndDefer(instance, m);
    return instance;
  };
  const instances = (ttq._i ??= {}) as Record<string, Ttq>;
  instances[id] = [] as unknown as Ttq;
  instances[id]._u = src;
  ((ttq._t ??= {}) as Record<string, number>)[id] = Date.now();
  ((ttq._o ??= {}) as Record<string, object>)[id] = {};
  window.ttq = ttq as unknown as Window['ttq'];
  loadScript(`${src}?sdkid=${encodeURIComponent(id)}&lib=ttq`);
}

/** Carrega os rastreadores configurados. Retorna true se algo foi ativado. */
export function loadTrackers(cfg: TrackingConfig): boolean {
  if (loaded) return true;
  const ga = cfg.googleAnalyticsId?.trim().toUpperCase();
  const meta = cfg.facebookPixelId?.trim();
  const tiktok = cfg.tiktokPixelId?.trim().toUpperCase();
  if (ga && GA_ID.test(ga)) initGoogle(ga);
  if (meta && META_ID.test(meta)) initMeta(meta);
  if (tiktok && TIKTOK_ID.test(tiktok)) initTikTok(tiktok);
  if (cfg.headCode?.trim()) injectHtml(document.head, cfg.headCode);
  if (cfg.bodyCode?.trim()) injectHtml(document.body, cfg.bodyCode);
  loaded = Boolean(window.gtag || window.fbq || window.ttq || cfg.headCode?.trim() || cfg.bodyCode?.trim());
  return loaded;
}

export function trackPageView(path: string): void {
  if (!loaded) return;
  window.gtag?.('event', 'page_view', { page_path: path, page_location: window.location.href, page_title: document.title });
  window.fbq?.('track', 'PageView');
  window.ttq?.page?.();
  pending.splice(0).forEach((send) => send());
}

export interface TrackedItem {
  id: string;
  name: string;
  price: number;
  quantity?: number;
}

type CommerceEvent = 'view_item' | 'add_to_cart' | 'begin_checkout';

const META_EVENTS: Record<CommerceEvent, string> = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
};

const TIKTOK_EVENTS: Record<CommerceEvent, string> = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
};

export function trackCommerce(event: CommerceEvent, items: TrackedItem[], currency = 'BRL'): void {
  if (items.length === 0) return;
  if (!loaded) {
    // Aguarda o consentimento/carregamento (ex.: visitante que chega direto num produto).
    if (getConsent() !== 'declined' && pending.length < 20) pending.push(() => trackCommerce(event, items, currency));
    return;
  }
  const value = Number(items.reduce((sum, i) => sum + i.price * (i.quantity ?? 1), 0).toFixed(2));
  window.gtag?.('event', event, {
    currency,
    value,
    items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity ?? 1 })),
  });
  window.fbq?.('track', META_EVENTS[event], {
    content_ids: items.map((i) => i.id),
    content_name: items.length === 1 ? items[0].name : undefined,
    content_type: 'product',
    num_items: items.reduce((n, i) => n + (i.quantity ?? 1), 0),
    value,
    currency,
  });
  window.ttq?.track?.(TIKTOK_EVENTS[event], {
    contents: items.map((i) => ({ content_id: i.id, content_name: i.name, quantity: i.quantity ?? 1, price: i.price })),
    content_type: 'product',
    value,
    currency,
  });
}

/** ID numérico de um GID da Shopify (gid://shopify/Product/123 → 123). */
export function shopifyNumericId(gid: string): string {
  return gid.match(/(\d+)(?:\?.*)?$/)?.[1] ?? gid;
}
