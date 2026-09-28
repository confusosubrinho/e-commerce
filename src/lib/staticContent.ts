/**
 * Conteúdo estático da loja.
 *
 * Intercepta leituras (GET/HEAD) das tabelas de conteúdo/configuração da loja
 * e responde com o snapshot fixo em `src/data/contentSnapshot.json`, emulando
 * os filtros simples do PostgREST (eq, in, order, limit...). Assim a vitrine
 * não depende do banco para exibir conteúdo. O painel admin (/admin) continua
 * lendo o banco normalmente. Para atualizar o conteúdo, regenere o snapshot.
 *
 * Precisa ser importado ANTES do cliente Supabase (primeiro import do main.tsx).
 */
import snapshot from '@/data/contentSnapshot.json';

type Row = Record<string, unknown>;
const TABLES = snapshot as unknown as Record<string, Row[]>;

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

function handle(url: URL, headers: Headers): Response | null {
  const match = url.pathname.match(/\/rest\/v1\/([a-z_]+)$/);
  if (!match) return null;
  const table = TABLES[match[1]];
  if (!table) return null;

  let rows = [...table];
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

export function installStaticContent(): void {
  if (typeof window === 'undefined' || !window.fetch) return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if ((method === 'GET' || method === 'HEAD') && !isAdminRoute()) {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        const res = handle(url, headers);
        if (res) return Promise.resolve(res);
      }
    } catch {
      // Em caso de erro, segue para a rede normalmente.
    }
    return originalFetch(input, init);
  };
}

installStaticContent();
