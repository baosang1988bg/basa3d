import { spawn } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
process.env.ORDER_CONFIRMATION_SECRET ??= 'hardening-followup-test-secret-at-least-32-characters';
// Isolated from the default `.next` a developer's `npm run dev` is using — `next dev` and
// `next build`/`next start` write incompatible webpack module-ID layouts into their distDir, so
// sharing `.next` between this test server and a concurrently running dev server corrupts
// whichever one runs second (see next.config.mjs's NEXT_DIST_DIR comment).
process.env.NEXT_DIST_DIR ??= '.next-test';

const port = 3411;
const baseUrl = `http://localhost:${port}`;

async function runNextBuild(): Promise<void> {
  const build = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
  const exitCode = await new Promise<number>((resolve) => build.once('exit', (code) => resolve(code ?? 1)));
  if (exitCode !== 0) throw new Error(`next build (into ${process.env.NEXT_DIST_DIR}) failed with exit code ${exitCode}`);
}

// `next build`/`next dev` unconditionally rewrite these two tracked files to reference whichever
// distDir is currently active (for typed-route support) — regenerating them for `.next-test` here
// would leave the repo's tsconfig/next-env pointed away from the developer's real `.next` after
// every test run. Snapshot and restore them so a test run is side-effect-free on disk.
const TRACKED_FILES_MUTATED_BY_NEXT = ['next-env.d.ts', 'tsconfig.json'];

async function snapshotTrackedFiles(): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();
  for (const file of TRACKED_FILES_MUTATED_BY_NEXT) snapshot.set(file, await readFile(file, 'utf8'));
  return snapshot;
}

async function restoreTrackedFiles(snapshot: Map<string, string>): Promise<void> {
  for (const [file, content] of snapshot) await writeFile(file, content, 'utf8');
}

async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${baseUrl}/admin/login`)).ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Server did not become ready on ${baseUrl} within ${timeoutMs}ms`);
}

async function stopServer(server: ReturnType<typeof spawn>): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) return;
  server.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      server.kill('SIGKILL');
      resolve();
    }, 5_000);
    server.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function main(): Promise<void> {
  const trackedFilesSnapshot = process.env.DATABASE_URL ? await snapshotTrackedFiles() : undefined;
  try {
    if (process.env.DATABASE_URL) await runNextBuild();
    const server = process.env.DATABASE_URL
      ? spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { cwd: process.cwd(), env: process.env, stdio: 'inherit' })
      : undefined;
    try {
      if (server) await waitForServer(30_000);
      const testFiles = (await readdir('tests'))
        .filter((name) => name.endsWith('.test.ts'))
        .sort()
        .map((name) => `tests/${name}`);
      const tests = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...testFiles], {
        cwd: process.cwd(), env: process.env, stdio: 'inherit',
      });
      const exitCode = await new Promise<number>((resolve) => tests.once('exit', (code) => resolve(code ?? 1)));
      process.exitCode = exitCode;
    } finally {
      if (server) await stopServer(server);
    }
  } finally {
    if (trackedFilesSnapshot) await restoreTrackedFiles(trackedFilesSnapshot);
  }
}

await main();
