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
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [{ protocol: 'https', hostname: supabaseHostname, pathname: '/storage/v1/object/public/**' }]
        : []),
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
};

export default nextConfig;
