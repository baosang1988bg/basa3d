import { isEnglishEnabled } from './routing';

/** The EN URL for an unprefixed VI path (`/` → `/en`, `/products` → `/en/products`). */
export function englishPath(path: string): string {
  return path === '/' ? '/en' : `/en${path}`;
}

/**
 * `alternates` metadata for a storefront page. hreflang `languages` are only emitted while EN is
 * routable — advertising `/en/*` while it redirects to VI would send search engines to a redirect.
 */
export function localeAlternates(path: string, englishEnabled: boolean = isEnglishEnabled) {
  return englishEnabled
    ? { canonical: path, languages: { vi: path, en: englishPath(path) } }
    : { canonical: path };
}
