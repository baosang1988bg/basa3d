import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS entirely. Server-only: never import this from a Client
// Component or anything that could ship the key to the browser (security checklist: "Never
// expose service-role key to browser"). Used for: creating STAFF Supabase Auth accounts, and
// product image uploads to a private-by-default Storage API surface.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL must be configured.');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY must be configured.');
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
