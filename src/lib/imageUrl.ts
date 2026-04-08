/**
 * Image URL resolver - ensures all image URLs are valid public URLs.
 * Strips expired signatures, normalizes URLs, and optionally resizes (e.g. Tray CDN).
 */

const PLACEHOLDER = '/placeholder.svg';
const SUPABASE_BASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function absolutizeSupabaseStoragePath(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = url.startsWith('/') ? url : `/${url}`;
  if (!normalized.startsWith('/storage/v1/object/')) return url;
  if (!SUPABASE_BASE_URL) return normalized;
  return `${SUPABASE_BASE_URL}${normalized}`;
}

function normalizeSupabaseObjectPublicPath(pathname: string): string {
  const marker = '/storage/v1/object/public/';
  const idx = pathname.indexOf(marker);
  if (idx < 0) return pathname;

  const prefix = pathname.slice(0, idx + marker.length);
  const rest = pathname.slice(idx + marker.length);
  if (!rest) return pathname;

  const firstSlash = rest.indexOf('/');
  if (firstSlash <= 0) return pathname;

  const bucket = rest.slice(0, firstSlash);
  const rawObjectPath = rest.slice(firstSlash + 1);
  if (!rawObjectPath) return pathname;

  const decodedObjectPath = safeDecodeURIComponent(rawObjectPath);
  const normalizedObjectPath = decodedObjectPath
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${prefix}${bucket}/${normalizedObjectPath}`;
}

/**
 * Converte URL assinada de objeto Supabase ("/object/sign/") para URL pública
 * quando o bucket é público, removendo query params expiráveis.
 */
function normalizeSupabaseSignedPath(url: string): string {
  if (!url) return url;
  const withAbsoluteStoragePath = absolutizeSupabaseStoragePath(url);
  const signedSegment = "/storage/v1/object/sign/";
  const publicSegment = "/storage/v1/object/public/";
  const shouldConvertSigned = withAbsoluteStoragePath.includes(signedSegment);

  try {
    const urlObj = new URL(withAbsoluteStoragePath);
    if (shouldConvertSigned) {
      urlObj.pathname = urlObj.pathname.replace(signedSegment, publicSegment);
      urlObj.search = "";
    }
    if (urlObj.pathname.includes(publicSegment)) {
      urlObj.pathname = normalizeSupabaseObjectPublicPath(urlObj.pathname);
    }
    return urlObj.toString();
  } catch {
    // Fallback para URLs sem parse válido no runtime atual
    const maybePublic = shouldConvertSigned
      ? withAbsoluteStoragePath.replace(signedSegment, publicSegment)
      : withAbsoluteStoragePath;
    return maybePublic.split("?")[0].replace(/%2F/gi, "/");
  }
}

/**
 * Indica se a URL é do CDN da Tray (images.tcdn.com.br).
 * Imagens de categoria/produto vindas da Tray costumam ser muito grandes para o tamanho exibido.
 */
export function isTrayCdnUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes('tcdn.com.br');
  } catch {
    return false;
  }
}

/**
 * Retorna URL de imagem redimensionada via proxy público (wsrv.nl) para URLs do Tray.
 * Reduz drasticamente o peso em grids (ex.: 3865x3834 → 320px).
 */
function getTrayResizedUrl(url: string, width: number, height?: number): string {
  const encoded = encodeURIComponent(url);
  const w = `w=${width}`;
  const h = height ? `&h=${height}` : '';
  return `https://wsrv.nl/?url=${encoded}&${w}${h}&fit=cover&n=-1`;
}

/**
 * Check if a URL contains expired signature parameters
 */
function hasSignatureParams(url: string): boolean {
  return /[?&](X-Amz-|Expires=|Signature=|AWSAccessKeyId=)/i.test(url);
}

/**
 * Strip signature querystring from a URL, keeping the base path
 */
function stripSignature(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove all AWS signature params
    const keysToRemove: string[] = [];
    urlObj.searchParams.forEach((_, key) => {
      if (/^(X-Amz-|Expires|Signature|AWSAccessKeyId)/i.test(key)) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach(k => urlObj.searchParams.delete(k));
    return urlObj.toString();
  } catch {
    return url.split('?')[0];
  }
}

export type ResolveImageUrlOptions = {
  /** Largura máxima desejada (px). Para URLs Tray, aplica resize via proxy. */
  width?: number;
  /** Altura máxima desejada (px). Opcional para Tray. */
  height?: number;
};

/**
 * Normalize a media URL stored in DB (image/video):
 * - trims and rejects empty values
 * - converts Supabase signed object URL to public URL
 * - normalizes encoded object paths
 * - strips signature query params when present
 */
export function normalizeSupabaseMediaUrl(url: string | null | undefined): string {
  if (!url || url.trim() === '') return '';
  let normalized = normalizeSupabaseSignedPath(url.trim());
  if (hasSignatureParams(normalized)) {
    normalized = stripSignature(normalized);
  }
  return normalized;
}

/**
 * Resolve an image URL to a valid, displayable URL.
 * - Supabase public URLs are returned as-is (unless options.width for future use)
 * - Tray CDN (tcdn.com.br): if options.width is set, returns resized URL via proxy (~320px)
 * - Signed/expired URLs are stripped of signatures
 * - Empty/null URLs return placeholder
 */
export function resolveImageUrl(
  url: string | null | undefined,
  options?: ResolveImageUrlOptions
): string {
  if (!url || url.trim() === '') return PLACEHOLDER;

  url = normalizeSupabaseMediaUrl(url);

  // Redimensionar imagens Tray para reduzir peso (PageSpeed: "melhorar entrega de imagens")
  const width = options?.width ?? 0;
  if (width > 0 && isTrayCdnUrl(url)) {
    return getTrayResizedUrl(url, width, options?.height);
  }

  return url;
}

/**
 * Check if an image URL is likely broken (expired signed URL)
 */
export function isImageUrlBroken(url: string | null | undefined): boolean {
  if (!url) return true;
  return hasSignatureParams(url);
}
