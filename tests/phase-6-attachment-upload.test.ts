import assert from 'node:assert/strict';
import test from 'node:test';
import nextEnv from '@next/env';
import { DomainError } from '../src/lib/domain-error.js';
import { uploadCustomRequestAttachment } from '../src/services/custom-request.service.js';

nextEnv.loadEnvConfig(process.cwd());

// These validate before any Supabase Storage call, so they run without service-role credentials.
test('rejects a file with a disallowed extension', async () => {
  const file = new Blob([new Uint8Array([1, 2, 3])]);
  await assert.rejects(
    () => uploadCustomRequestAttachment({ file, fileName: 'model.blend' }),
    (error: unknown) => error instanceof DomainError && error.code === 'INVALID_FILE_TYPE',
  );
});

test('rejects a file over the 20MB limit', async () => {
  const file = new Blob([new Uint8Array(20 * 1024 * 1024 + 1)]);
  await assert.rejects(
    () => uploadCustomRequestAttachment({ file, fileName: 'model.stl' }),
    (error: unknown) => error instanceof DomainError && error.code === 'FILE_TOO_LARGE',
  );
});

test('rejects an empty file', async () => {
  const file = new Blob([]);
  await assert.rejects(
    () => uploadCustomRequestAttachment({ file, fileName: 'model.stl' }),
    (error: unknown) => error instanceof DomainError && error.code === 'EMPTY_FILE',
  );
});

