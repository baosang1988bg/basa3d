import { cache } from 'react';
import { query } from '../db';
import { createSupabaseAdminClient } from '../supabase/admin';

// staff_profiles has no email column (docs/database/schema.md) — email lives only in
// auth.users, so it's resolved per-recipient via the Supabase Admin API using the service-role
// client. Wrapped in React's cache() so a single request's notify call never queries
// staff_profiles/auth.admin more than once, per phase-15.md decision #3.
export const resolveActiveStaffRecipientEmails = cache(async (): Promise<string[]> => {
  const staff = await query<{ id: string }>('select id from staff_profiles where is_active = true');
  if (!staff.rowCount) return [];
  const admin = createSupabaseAdminClient();
  const emails = await Promise.all(staff.rows.map(async (row) => {
    const { data, error } = await admin.auth.admin.getUserById(row.id);
    if (error || !data.user?.email) return null;
    return data.user.email;
  }));
  return emails.filter((email): email is string => Boolean(email));
});
