import nextEnv from '@next/env';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function localUrl(value: string, label: string): URL {
  const url = new URL(value);
  if (!LOCAL_HOSTS.has(url.hostname)) throw new Error(`${label} must use a local, disposable test service. Hosted databases are blocked.`);
  return url;
}

export function isolatedTestEnvironment(env: Record<string, string | undefined>): Record<string, string | undefined> {
  const database = env.TEST_DATABASE_URL ?? '';
  const supabase = env.TEST_SUPABASE_URL ?? '';
  if (database) {
    const test = localUrl(database, 'TEST_DATABASE_URL');
    if (!['postgres:', 'postgresql:'].includes(test.protocol)) throw new Error('TEST_DATABASE_URL must be PostgreSQL');
    if (env.DATABASE_URL && env.BASA3D_TEST_ENVIRONMENT !== 'isolated') {
      const app = new URL(env.DATABASE_URL);
      const sameHost = app.hostname === test.hostname || (LOCAL_HOSTS.has(app.hostname) && LOCAL_HOSTS.has(test.hostname));
      if (sameHost && (app.port || '5432') === (test.port || '5432') && app.pathname === test.pathname) {
        throw new Error('TEST_DATABASE_URL must not target the app database');
      }
    }
  }
  if (supabase) {
    const test = localUrl(supabase, 'TEST_SUPABASE_URL');
    if (!['http:', 'https:'].includes(test.protocol)) throw new Error('TEST_SUPABASE_URL must use HTTP(S)');
    if (env.NEXT_PUBLIC_SUPABASE_URL && env.BASA3D_TEST_ENVIRONMENT !== 'isolated') {
      const app = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
      if (LOCAL_HOSTS.has(app.hostname) && app.port === test.port) throw new Error('TEST_SUPABASE_URL must not target the app Supabase service');
    }
  }
  // Empty strings intentionally mask .env values even when Next loads it again in a child.
  return {
    DATABASE_URL: database,
    NEXT_PUBLIC_SUPABASE_URL: supabase,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabase ? env.TEST_SUPABASE_ANON_KEY ?? '' : '',
    SUPABASE_SERVICE_ROLE_KEY: supabase ? env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? '' : '',
    RESEND_API_KEY: '',
    RESEND_FROM_EMAIL: '',
    NEXT_PUBLIC_GA_ID: '',
  };
}

let configured = false;
export function configureTestEnvironment(): void {
  if (configured) return;
  nextEnv.loadEnvConfig(process.cwd());
  const isolated = isolatedTestEnvironment(process.env);
  Object.assign(process.env, isolated);
  process.env.BASA3D_TEST_ENVIRONMENT = 'isolated';
  nextEnv.updateInitialEnv(isolated);
  configured = true;
}
