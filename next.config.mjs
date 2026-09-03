/**
 * Product images are served from Supabase Storage public URLs shaped
 * `https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/<path>`.
 * next/image's optimizer rejects any remote host that is not allowlisted here, so without this the
 * storefront's <Image> tags would 400 in production. The hostname is derived from the same env var
 * the app uses for Supabase; the `*.supabase.co` wildcard is the fallback when the var is absent at
 * build time (next.config is evaluated at build/start, not per-request).
 *
 * @type {import('next').NextConfig}
 */
const supabaseHostname = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig = {
  // `npm test` builds and runs a production server (tests/helpers/test-runner.ts) in the same repo
  // a developer may have `npm run dev` running in. `next dev` and `next build`/`next start` write
  // incompatible webpack module-ID layouts into whatever distDir they're pointed at — sharing the
  // default `.next` between them corrupts whichever one runs second (manifests as "Cannot find
  // module './NNNN.js'" or "Cannot read properties of undefined (reading '/_app')" the next time
  // `next dev` starts). NEXT_DIST_DIR isolates the test build into `.next-test` so the two never
  // touch the same directory.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [{ protocol: 'https', hostname: supabaseHostname, pathname: '/storage/v1/object/public/**' }]
        : []),
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      // Static VietQR transfer QR on the order-confirmation page (Phase 5, ADR-0014).
      { protocol: 'https', hostname: 'img.vietqr.io', pathname: '/image/**' },
    ],
  },
};

export default nextConfig;
