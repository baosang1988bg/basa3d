import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { createSupabaseAdminClient } from '../lib/supabase/admin';
import { writeAuditLog } from './audit.service';

export async function listStaff() {
  // auth.users lives in Supabase's own schema; readable directly since the app connects with
  // the full-access DATABASE_URL role (no PostgREST/RLS in this request path, per ADR-0012).
  const result = await query<{ id: string; fullName: string; role: 'OWNER' | 'STAFF'; isActive: boolean; email: string; createdAt: string }>(`
    select sp.id, sp.full_name as "fullName", sp.role, sp.is_active as "isActive", au.email, sp.created_at as "createdAt"
    from staff_profiles sp join auth.users au on au.id = sp.id
    order by sp.created_at desc`);
  return result.rows;
}

export async function createStaffAccount(input: { email: string; password: string; fullName: string; role: 'OWNER' | 'STAFF' }, actorId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true });
  if (error || !data.user) throw new DomainError('STAFF_ACCOUNT_CREATE_FAILED', error?.message ?? 'Could not create the auth account.', 502);

  try {
    return await withTransaction(async (client) => {
      const result = await client.query<{ id: string; fullName: string; role: string }>(
        'insert into staff_profiles (id, full_name, role) values ($1,$2,$3) returning id, full_name as "fullName", role',
        [data.user.id, input.fullName, input.role],
      );
      await writeAuditLog(client, { actorId, action: 'STAFF_CREATED', entityType: 'staff_profile', entityId: data.user.id, afterData: { email: input.email, fullName: input.fullName, role: input.role } });
      return result.rows[0];
    });
  } catch (dbError) {
    // Roll back the auth user too — otherwise we'd have a login with no staff_profiles row,
    // which requireAdmin() would reject with a confusing FORBIDDEN. If the rollback itself fails,
    // don't mask the original error — log the orphaned-account risk loudly so an OWNER can clean
    // it up manually via the Supabase dashboard, and still surface the real failure to the caller.
    try {
      await supabase.auth.admin.deleteUser(data.user.id);
    } catch (rollbackError) {
      console.error(`Failed to roll back orphaned Supabase Auth user ${data.user.id} (email ${input.email}) after staff_profiles insert failed — manual cleanup needed.`, rollbackError);
    }
    throw dbError;
  }
}

export async function setStaffActive(staffId: string, isActive: boolean, actorId: string) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string; isActive: boolean }>('update staff_profiles set is_active = $2 where id = $1 returning id, is_active as "isActive"', [staffId, isActive]);
    if (!result.rowCount) throw new DomainError('STAFF_NOT_FOUND', 'Staff profile was not found.', 404);
    await writeAuditLog(client, { actorId, action: isActive ? 'STAFF_REACTIVATED' : 'STAFF_DEACTIVATED', entityType: 'staff_profile', entityId: staffId });
    return result.rows[0];
  });
}
