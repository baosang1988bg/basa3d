import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function env(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured for Supabase Auth.`);
  return value;
}

// For Server Components / Route Handlers / Server Actions. Reads the session from cookies;
// per ADR-0012 this is only used for auth.getUser(), never for querying business tables
// (that stays on the existing pg.Pool, see src/lib/db.ts).
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component that can't set cookies — middleware refreshes the
          // session on the next request instead. Safe to ignore here.
        }
      },
    },
  });
}
