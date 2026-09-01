import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { DomainError } from '../src/lib/domain-error.js';
import { resolveStaffSession } from '../src/lib/auth/require-admin.js';
import { getPool, query } from '../src/lib/db.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

test('resolveStaffSession rejects an anonymous caller', { skip: !process.env.DATABASE_URL }, async () => {
  await assert.rejects(
    () => resolveStaffSession(null),
    (error: unknown) => error instanceof DomainError && error.code === 'AUTH_REQUIRED' && error.status === 401,
  );
});

test('resolveStaffSession rejects an authenticated user with no staff_profiles row', { skip: !process.env.DATABASE_URL }, async () => {
  await assert.rejects(
    () => resolveStaffSession('00000000-0000-4000-8000-000000000999'),
    (error: unknown) => error instanceof DomainError && error.code === 'FORBIDDEN' && error.status === 403,
  );
});

test('resolveStaffSession enforces is_active and returns the correct role', { skip: !process.env.DATABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY }, async () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `phase3-auth-test-${Date.now()}@example.com`;
  const { data, error } = await supabase.auth.admin.createUser({ email, password: 'test-password-123', email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser returned no user');
  const userId = data.user.id;
  try {
    await query('insert into staff_profiles (id, full_name, role, is_active) values ($1, $2, $3, $4)', [userId, 'Test Staff', 'STAFF', true]);

    const session = await resolveStaffSession(userId);
    assert.equal(session.actorId, userId);
    assert.equal(session.role, 'STAFF');

    await query('update staff_profiles set is_active = false where id = $1', [userId]);
    await assert.rejects(
      () => resolveStaffSession(userId),
      (rejectError: unknown) => rejectError instanceof DomainError && rejectError.code === 'FORBIDDEN',
    );
  } finally {
    await query('delete from staff_profiles where id = $1', [userId]);
    await supabase.auth.admin.deleteUser(userId);
  }
});

test('Auth user deletion is rejected while staff_profiles still references the user', { skip: !process.env.DATABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY }, async () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `phase3-fk-restrict-${Date.now()}@example.com`;
  const { data, error } = await supabase.auth.admin.createUser({ email, password: 'test-password-123', email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser returned no user');
  const userId = data.user.id;
  try {
    await query('insert into staff_profiles (id, full_name, role, is_active) values ($1, $2, $3, true)', [userId, 'FK Restrict Test', 'STAFF']);
    const deletion = await supabase.auth.admin.deleteUser(userId);
    assert.ok(deletion.error, 'Auth deletion must be rejected by staff_profiles_id_fkey');
    const profile = await query('select id from staff_profiles where id = $1', [userId]);
    assert.equal(profile.rowCount, 1, 'the linked staff profile must remain after rejected Auth deletion');
  } finally {
    await query('delete from staff_profiles where id = $1', [userId]);
    await supabase.auth.admin.deleteUser(userId);
  }
});
