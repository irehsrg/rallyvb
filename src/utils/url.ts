/**
 * Return the URL if it is an absolute http(s) URL, otherwise null.
 * Used wherever user-supplied links (e.g. Google Maps URLs) are stored or
 * rendered into an href, so `javascript:` / `data:` links are never emitted.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Reduce a notification/link target to a same-origin path.
 * Anything on another origin, or unparseable, falls back to `fallback`.
 */
export function sameOriginPath(value: string | null | undefined, origin: string, fallback = '/'): string {
  if (!value) return fallback;
  try {
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin) return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}
