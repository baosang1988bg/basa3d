import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Must match themeBootstrapScript in src/lib/theme-script.ts. A focused test guards drift.
const themeBootstrapSha256 = 'juHZOERlE4qisK7x2nBcrg1t1koqMPODe+dy9NfUa0s=';
const contentSecurityPolicyReportOnly = [
  "default-src 'self'",
  `script-src 'self' 'sha256-${themeBootstrapSha256}' https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://img.vietqr.io https://*.bblmw.com https://image.makerworld.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://*.google-analytics.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicyReportOnly },
];

const supabaseHostname = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
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

export default withNextIntl(nextConfig);



