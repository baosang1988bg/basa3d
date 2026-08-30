import { createBrowserClient } from '@supabase/ssr';

// Next.js only inlines `process.env.NEXT_PUBLIC_*` into the browser bundle when the property is
// accessed with a static, literal dot path — NOT through a shared helper using bracket/variable
// access (that pattern breaks the build-time replacement, leaving `process.env` empty at runtime
// in the browser, since only Node has a real `process.env`). So these two reads must stay exactly
// like this, not refactored into a shared `env(name)` function like server.ts/middleware.ts use.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// For Client Components only (the login form). Never used to query business tables.
export function createSupabaseBrowserClient() {
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL must be configured for Supabase Auth.');
  if (!supabaseAnonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured for Supabase Auth.');
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
