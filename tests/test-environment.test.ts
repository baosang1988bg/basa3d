import assert from 'node:assert/strict';
import test from 'node:test';
import { isolatedTestEnvironment } from './helpers/test-environment';

test('unit-only execution masks app database, auth, email and analytics credentials', () => {
  const result = isolatedTestEnvironment({ DATABASE_URL: 'postgres://owner:secret@db.example.com/app', NEXT_PUBLIC_SUPABASE_URL: 'https://app.example.com', SUPABASE_SERVICE_ROLE_KEY: 'app-key', RESEND_API_KEY: 'mail-key' });
  const sensitiveKeys = ['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'NEXT_PUBLIC_GA_ID'] as const;
  assert.ok(sensitiveKeys.every((key) => result[key] === ''));
});

test('remote test databases and Supabase services are refused', () => {
  assert.throws(() => isolatedTestEnvironment({ TEST_DATABASE_URL: 'postgres://user:secret@db.example.com/test' }), /Hosted databases are blocked/);
  assert.throws(() => isolatedTestEnvironment({ TEST_SUPABASE_URL: 'https://project.supabase.co' }), /Hosted databases are blocked/);
});

test('local hostname aliases and different credentials cannot bypass app database protection', () => {
  assert.throws(() => isolatedTestEnvironment({ DATABASE_URL: 'postgres://owner:a@localhost/app', TEST_DATABASE_URL: 'postgres://test:b@127.0.0.1:5432/app' }), /must not target the app database/);
  assert.throws(() => isolatedTestEnvironment({ NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321', TEST_SUPABASE_URL: 'http://127.0.0.1:54321' }), /must not target the app Supabase/);
});

test('an explicitly configured disposable local database and auth service are selected', () => {
  const result = isolatedTestEnvironment({ DATABASE_URL: 'postgres://owner:secret@db.example.com/app', TEST_DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:54322/postgres', TEST_SUPABASE_URL: 'http://127.0.0.1:54321', TEST_SUPABASE_ANON_KEY: 'local-anon', TEST_SUPABASE_SERVICE_ROLE_KEY: 'local-service' });
  assert.equal(result.DATABASE_URL, 'postgres://postgres:postgres@127.0.0.1:54322/postgres');
  assert.equal(result.SUPABASE_SERVICE_ROLE_KEY, 'local-service');
  assert.equal(result.RESEND_API_KEY, '');
});
