/**
 * Conteúdo estático da loja.
 *
 * Intercepta leituras (GET/HEAD) das tabelas de conteúdo/configuração da loja
 * e responde com um snapshot, emulando os filtros simples do PostgREST
 * (eq, in, order, limit...). Assim a vitrine não consulta o banco para exibir
 * conteúdo. O snapshot vem do arquivo publicado no Storage (gerado pela edge
 * function `publish-content-snapshot`) e, se ele falhar, do arquivo embutido
 * `src/data/contentSnapshot.json`.
 *
 * No /admin as leituras vão ao banco, e toda gravação bem-sucedida numa tabela
 * de conteúdo dispara a republicação do snapshot.
 *
 * Precisa ser importado ANTES do cliente Supabase (primeiro import do main.tsx).
 */
import bundled from '@/data/contentSnapshot.json';

type Row = Record<string, unknown>;
let TABLES = bundled as unknown as Record<string, Row[]>;
const SNAPSHOT_TABLES = new Set(Object.keys(TABLES));
const ADMIN_WRITE_TABLES = new Set([...SNAPSHOT_TABLES, 'store_settings']);

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
const REMOTE_SNAPSHOT_URL = `${SUPABASE_URL}/storage/v1/object/public/site-content/content-snapshot.json`;
const REMOTE_TIMEOUT_MS = 2500;
const PUBLISH_DEBOUNCE_MS = 1500;

export const PUBLISH_EVENT = 'content-snapshot:publish';
export type PublishStatus = 'pending' | 'publishing' | 'published' | 'error';

function parseValue(raw: string): unknown {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

function eqLoose(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null) return false;
  return String(a) === String(b);
}

function likeToRegex(pattern: string, insensitive: boolean): RegExp {
  const esc = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*');
  return new RegExp(`^${esc}$`, insensitive ? 'i' : '');
}

function matches(value: unknown, op: string, arg: string): boolean {
  switch (op) {
    case 'eq': return eqLoose(value, parseValue(arg));
    case 'neq': return !eqLoose(value, parseValue(arg));
    case 'is': return arg === 'null' ? value === null || value === undefined : eqLoose(value, parseValue(arg));
    case 'in': {
      const list = arg.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));
      return list.some((v) => eqLoose(value, v));
    }
    case 'gt': return String(value ?? '') > arg && value !== null;
    case 'gte': return value !== null && (Number.isNaN(Number(arg)) ? String(value) >= arg : Number(value) >= Number(arg));
    case 'lt': return value !== null && (Number.isNaN(Number(arg)) ? String(value) < arg : Number(value) < Number(arg));
    case 'lte': return value !== null && (Number.isNaN(Number(arg)) ? String(value) <= arg : Number(value) <= Number(arg));
    case 'like': return likeToRegex(arg, false).test(String(value ?? ''));
    case 'ilike': return likeToRegex(arg, true).test(String(value ?? ''));
    default: return true;
  }
}

function applyFilter(rows: Row[], column: string, expr: string): Row[] {
  let negate = false;
  let rest = expr;
  if (rest.startsWith('not.')) { negate = true; rest = rest.slice(4); }
  const dot = rest.indexOf('.');
  if (dot < 0) return rows;
  const op = rest.slice(0, dot);
  const arg = rest.slice(dot + 1);
  return rows.filter((r) => matches(r[column], op, arg) !== negate);
}

function applyOrder(rows: Row[], order: string): Row[] {
  const specs = order.split(',').map((s) => {
    const [col, dir = 'asc', nulls] = s.split('.');
    return { col, desc: dir === 'desc', nullsFirst: nulls ? nulls === 'nullsfirst' : dir === 'desc' };
  });
  return [...rows].sort((a, b) => {
    for (const { col, desc, nullsFirst } of specs) {
      const va = a[col];
      const vb = b[col];
      if (va === vb) continue;
      if (va === null || va === undefined) return nullsFirst ? -1 : 1;
      if (vb === null || vb === undefined) return nullsFirst ? 1 : -1;
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}

function tableFromUrl(url: URL): string | null {
  return url.pathname.match(/\/rest\/v1\/([a-z_]+)$/)?.[1] ?? null;
}

function handle(url: URL, headers: Headers): Response {
  let rows = [...(TABLES[tableFromUrl(url)!] ?? [])];
  let order: string | null = null;
  let limit: number | null = null;
  let offset = 0;
  url.searchParams.forEach((value, key) => {
    if (key === 'select' || key === 'columns') return;
    if (key === 'order') { order = value; return; }
    if (key === 'limit') { limit = Number(value); return; }
    if (key === 'offset') { offset = Number(value); return; }
    if (key === 'or' || key === 'and') return;
    rows = applyFilter(rows, key, value);
  });
  if (order) rows = applyOrder(rows, order);
  const total = rows.length;
  rows = rows.slice(offset, limit !== null ? offset + limit : undefined);

  const range = `${rows.length ? `${offset}-${offset + rows.length - 1}` : '*'}/${total}`;
  const accept = headers.get('Accept') ?? '';
  if (accept.includes('vnd.pgrst.object')) {
    if (rows.length !== 1) {
      return json({ code: 'PGRST116', details: `The result contains ${rows.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, 406);
    }
    return json(rows[0], 200, { 'Content-Range': range });
  }
  return json(rows, 200, { 'Content-Range': range });
}

function isAdminRoute(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
}

function isValidSnapshot(value: unknown): value is Record<string, Row[]> {
  return !!value && typeof value === 'object'
    && [...SNAPSHOT_TABLES].every((t) => Array.isArray((value as Record<string, unknown>)[t]));
}

let originalFetch: typeof fetch;
let ready: Promise<void> = Promise.resolve();

async function loadRemoteSnapshot(): Promise<void> {
  if (!SUPABASE_URL) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const res = await originalFetch(REMOTE_SNAPSHOT_URL, { cache: 'no-cache', signal: controller.signal });
    if (!res.ok) return;
    const body = await res.json();
    if (isValidSnapshot(body?.tables)) TABLES = body.tables;
  } catch {
    // Mantém o snapshot embutido.
  } finally {
    clearTimeout(timer);
  }
}

function emitStatus(status: PublishStatus, detail: Record<string, unknown> = {}): void {
  window.dispatchEvent(new CustomEvent(PUBLISH_EVENT, { detail: { status, ...detail } }));
}

let publishTimer: ReturnType<typeof setTimeout> | undefined;
let lastAuthorization = '';

export async function publishContentSnapshot(authorization = lastAuthorization): Promise<boolean> {
  clearTimeout(publishTimer);
  emitStatus('publishing');
  try {
    const res = await originalFetch(`${SUPABASE_URL}/functions/v1/publish-content-snapshot`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: authorization, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
    if (isValidSnapshot(body.data?.tables)) TABLES = body.data.tables;
    emitStatus('published', { publishedAt: body.data?.published_at });
    return true;
  } catch (error) {
    emitStatus('error', { message: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

function schedulePublish(authorization: string): void {
  lastAuthorization = authorization;
  clearTimeout(publishTimer);
  emitStatus('pending');
  publishTimer = setTimeout(() => void publishContentSnapshot(authorization), PUBLISH_DEBOUNCE_MS);
}

export function installStaticContent(): void {
  if (typeof window === 'undefined' || !window.fetch) return;
  originalFetch = window.fetch.bind(window);
  ready = loadRemoteSnapshot();
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
      const table = tableFromUrl(url);
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));

      if (table && SNAPSHOT_TABLES.has(table) && (method === 'GET' || method === 'HEAD') && !isAdminRoute()) {
        return ready.then(() => handle(url, headers));
      }

      if (table && ADMIN_WRITE_TABLES.has(table) && method !== 'GET' && method !== 'HEAD' && isAdminRoute()) {
        const authorization = headers.get('Authorization') ?? '';
        return originalFetch(input, init).then((res) => {
          if (res.ok && authorization) schedulePublish(authorization);
          return res;
        });
      }
    } catch {
      // Em caso de erro, segue para a rede normalmente.
    }
    return originalFetch(input, init);
  };
}

installStaticContent();
