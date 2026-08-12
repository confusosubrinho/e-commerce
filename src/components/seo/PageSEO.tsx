import { Helmet } from 'react-helmet-async';

type JsonLd = Record<string, unknown>;

interface PageSEOProps {
  title?: string;
  description?: string;
  image?: string | null;
  type?: 'website' | 'article' | 'product';
  /** Path relativo (ex.: "/produto/abc"). Se ausente, usa o pathname atual. */
  path?: string;
  /** Um ou vários blocos JSON-LD (ex.: Product + BreadcrumbList). */
  jsonLd?: JsonLd | JsonLd[] | null;
  noindex?: boolean;
}

const SITE_URL = 'https://vanessalimashoes.com.br';

/**
 * Normaliza o path para o canonical: remove query/hash, barra final duplicada
 * e força minúsculas — evitando URLs duplicadas para o mesmo conteúdo.
 */
function normalizePath(rawPath: string): string {
  const withoutQuery = rawPath.split('?')[0].split('#')[0];
  const lowered = withoutQuery.toLowerCase();
  if (lowered === '' || lowered === '/') return '/';
  return lowered.endsWith('/') ? lowered.slice(0, -1) : lowered;
}

/**
 * SEO por rota: title/description/canonical/OG + JSON-LD opcional.
 * O conteúdo institucional (textos, FAQ, redes) é gerenciado no admin via
 * page_contents/social_links; aqui só montamos as tags a partir desses dados.
 */
export function PageSEO({
  title,
  description,
  image,
  type = 'website',
  path,
  jsonLd,
  noindex,
}: PageSEOProps) {
  const pathname = normalizePath(
    path ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
  );
  const url = `${SITE_URL}${pathname === '/' ? '/' : pathname}`;
  const blocks: JsonLd[] = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />

      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type === 'product' ? 'product' : type} />
      <meta property="og:locale" content="pt_BR" />
      {image && <meta property="og:image" content={image} />}

      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}

      <meta
        name="robots"
        content={
          noindex
            ? 'noindex, nofollow'
            : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
        }
      />

      {blocks.map((block, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
}
