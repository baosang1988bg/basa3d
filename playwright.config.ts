import { defineConfig } from '@playwright/test';
import { configureTestEnvironment } from './tests/helpers/test-environment';

configureTestEnvironment();
if (!process.env.DATABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('E2E requires a disposable local TEST_DATABASE_URL and TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY / TEST_SUPABASE_SERVICE_ROLE_KEY. App credentials are never used.');
}
// Checkout is a required E2E flow even while Production temporarily hides the cart. Make the
// test behavior deterministic instead of inheriting a developer machine's public feature flag.
process.env.NEXT_PUBLIC_CART_ENABLED = 'true';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3412',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run start -- -p 3412',
    url: 'http://localhost:3412/admin/login',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
