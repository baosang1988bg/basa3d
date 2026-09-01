import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
process.env.ORDER_CONFIRMATION_SECRET ??= 'hardening-followup-test-secret-at-least-32-characters';

const port = 3411;
const baseUrl = `http://localhost:${port}`;

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
}

await main();
