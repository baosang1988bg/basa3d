// Phase 50 (B2): `/handbook` aliases for the Vietnamese `/cam-nang` page.
//
// next.config `redirects()` run BEFORE middleware, so each rule must land on the final URL in one
// hop — a generic `/:locale/handbook` would (a) also match `/products/handbook`, `/blog/handbook`,
// and (b) send `/vi/handbook` → `/vi/cam-nang` → (next-intl, as-needed prefix) `/cam-nang`, and
// `/en/handbook` with EN off → `/en/cam-nang` → (middleware 308) `/cam-nang`. Hence three literal
// sources. `englishEnabled` mirrors src/i18n/routing.ts (ADR-0048); NEXT_PUBLIC_* is fixed per
// build, so evaluating it here at build time matches the middleware.

/** @param {boolean} englishEnabled */
export function handbookRedirects(englishEnabled) {
  return [
    { source: '/handbook', destination: '/cam-nang', permanent: true },
    { source: '/vi/handbook', destination: '/cam-nang', permanent: true },
    { source: '/en/handbook', destination: englishEnabled ? '/en/cam-nang' : '/cam-nang', permanent: true },
  ];
}
