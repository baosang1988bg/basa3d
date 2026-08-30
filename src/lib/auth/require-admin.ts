import { query } from '../db';
import { DomainError } from '../domain-error';
import { createSupabaseServerClient } from '../supabase/server';

export type StaffRole = 'OWNER' | 'STAFF';
export type StaffSession = { actorId: string; role: StaffRole };

// Split out from requireAdmin() so the role/active-status logic (the part that actually
// enforces RBAC) can be integration-tested against a real staff_profiles row without needing
// a live cookie/session — see tests/phase-3-auth.test.ts.
export async function resolveStaffSession(userId: string | null): Promise<StaffSession> {
  if (!userId) throw new DomainError('AUTH_REQUIRED', 'Bạn cần đăng nhập để thực hiện thao tác này.', 401);
  const result = await query<{ role: StaffRole; is_active: boolean }>('select role, is_active from staff_profiles where id = $1', [userId]);
  if (!result.rowCount || !result.rows[0].is_active) {
    throw new DomainError('FORBIDDEN', 'Tài khoản chưa được cấp quyền truy cập admin.', 403);
  }
  return { actorId: userId, role: result.rows[0].role };
}

// ADR-0012: auth.getUser() (not getSession()) to force a server-side revalidation against
// Supabase Auth rather than trusting an unverified JWT read from the cookie.
export async function requireAdmin(): Promise<StaffSession> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return resolveStaffSession(user?.id ?? null);
}

// ADR-0011 boundary #1/#2/#3/#4: staff management, financial dashboard, hard delete, audit logs.
export async function requireOwner(): Promise<StaffSession> {
  const session = await requireAdmin();
  if (session.role !== 'OWNER') throw new DomainError('FORBIDDEN', 'Chỉ OWNER mới có quyền thực hiện thao tác này.', 403);
  return session;
}
