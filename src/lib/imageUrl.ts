/**
 * Image URL resolver - ensures all image URLs are valid public URLs.
 * Strips expired signatures, normalizes URLs, and optionally resizes (e.g. Tray CDN).
 */

const PLACEHOLDER = '/placeholder.svg';

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

  // If it has signature params, strip them
  if (hasSignatureParams(url)) {
    url = stripSignature(url);
  }

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
