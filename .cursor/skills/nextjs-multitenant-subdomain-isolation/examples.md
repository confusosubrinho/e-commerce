# Exemplos (copiar/colar)

## 1) `middleware.ts` (rewrite por subdomínio)

```ts
import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.[\\w]+).*)"],
};

const RESERVED_SUBDOMAINS = new Set(["www", "app", "admin", "api"]);

function getHostname(req: NextRequest): string {
  const host = req.headers.get("host") ?? req.nextUrl.host; // inclui porta
  return host.replace(/:\d+$/, "");
}

function getSubdomain(hostname: string): string | null {
  const parts = hostname.split(".");
  if (parts.length < 2) return null;
  const sub = parts[0]?.toLowerCase();
  if (!sub || RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}

export default function middleware(req: NextRequest) {
  const hostname = getHostname(req);
  const sub = getSubdomain(hostname);
  if (!sub) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/${sub}${url.pathname}`;
  return NextResponse.rewrite(url);
}
```

## 2) Resolver tenant no server (Route Handler)

```ts
import { NextRequest } from "next/server";

export interface Tenant {
  id: string;
  subdomain: string;
}

export interface TenantContext {
  tenant: Tenant;
  tenantId: string;
  tenantSlug: string;
}

function getHostname(req: NextRequest): string {
  const host = req.headers.get("host") ?? "";
  return host.replace(/:\d+$/, "");
}

function getTenantSlugFromHost(hostname: string): string | null {
  const parts = hostname.split(".");
  if (parts.length < 2) return null;
  return parts[0]?.toLowerCase() ?? null;
}

// Substitua por acesso real ao seu DB/repos.
async function findTenantBySlug(slug: string): Promise<Tenant | null> {
  return null;
}

export async function resolveTenantFromRequest(req: NextRequest): Promise<TenantContext> {
  const hostname = getHostname(req);
  const tenantSlug = getTenantSlugFromHost(hostname);
  if (!tenantSlug) throw new Error("Tenant não encontrado (sem subdomínio).");

  const tenant = await findTenantBySlug(tenantSlug);
  if (!tenant) throw new Error("Tenant não encontrado (slug inválido).");

  return { tenant, tenantId: tenant.id, tenantSlug: tenant.subdomain };
}
```

## 3) Uso em `app/[tenant]/page.tsx` (Server Component)

```ts
interface PageProps {
  params: Promise<{ tenant: string }>;
}

export default async function Page(props: PageProps) {
  const { tenant } = await props.params;
  return <main>Tenant: {tenant}</main>;
}
```

Nota: `params.tenant` vem do rewrite. Ainda assim, valide/resolve tenant no server antes de consultar dados.

