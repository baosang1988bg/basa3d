import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { Client } from 'pg';

export type StaffRole = 'OWNER' | 'STAFF';

export type MintedStaffAccount = {
  userId: string;
  email: string;
  /**
   * A real `Cookie:` header value for an authenticated session — produced by signing in through
   * the exact @supabase/ssr cookie-storage code path (`createServerClient` +
   * `auth.signInWithPassword`) that `src/lib/supabase/server.ts` uses in production, so route
   * handlers see byte-for-byte the same cookie shape (chunking/base64url encoding included) a real
   * logged-in browser would send. Not a hand-built or faked JWT — see phase-14.md Slice 1.
   */
  cookieHeader: string;
  cleanup: () => Promise<void>;
};

// Fixed per-run password; the account itself is throwaway (random email, deleted in cleanup()), so
// a fixed password carries no risk and keeps this helper simple.
const TEST_PASSWORD = 'rbac-boundary-test-password-123!';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set to mint RBAC test accounts.`);
  return value;
}

// Mints a real throwaway Supabase Auth user + an active staff_profiles row for the given role, then
// signs it in to get a real session cookie. Reuses e2e/admin.spec.ts's
// `supabase.auth.admin.createUser`/`deleteUser` throwaway-account pattern instead of inventing a
// new one — the only addition here is capturing the resulting session as an HTTP `Cookie` header so
// it can be used from plain `fetch()` against the `next start` test server (tests/phase-3-route-auth.test.ts),
// not just from a Playwright browser page (e2e/admin.spec.ts).
export async function mintStaffAccount(role: StaffRole): Promise<MintedStaffAccount> {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const databaseUrl = requiredEnv('DATABASE_URL');

  const email = `rbac-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@example.com`;
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser returned no user');
  const userId = data.user.id;

  const pg = new Client({ connectionString: databaseUrl });
  await pg.connect();
  try {
    await pg.query('insert into staff_profiles (id, full_name, role, is_active) values ($1, $2, $3, true)', [userId, `RBAC ${role} Test`, role]);
  } finally {
    await pg.end();
  }

  // Sign in through @supabase/ssr's own storage adapter (not the plain supabase-js client) so the
  // cookie name/chunking/encoding this produces matches exactly what
  // src/lib/supabase/server.ts's createSupabaseServerClient() expects to read back.
  const jar = new Map<string, string>();
  const ssr = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) jar.set(name, value);
      },
    },
  });
  const signIn = await ssr.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signIn.error || !signIn.data.session) throw signIn.error ?? new Error('signInWithPassword returned no session');

  const cookieHeader = Array.from(jar, ([name, value]) => `${name}=${value}`).join('; ');

  return {
    userId,
    email,
    cookieHeader,
    cleanup: async () => {
      const cleanupClient = new Client({ connectionString: databaseUrl });
      await cleanupClient.connect();
      try {
        await cleanupClient.query('delete from staff_profiles where id = $1', [userId]);
      } finally {
        await cleanupClient.end();
      }
      await admin.auth.admin.deleteUser(userId);
    },
  };
}
