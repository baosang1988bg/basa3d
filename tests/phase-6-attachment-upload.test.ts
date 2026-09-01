import assert from 'node:assert/strict';
import test from 'node:test';
import nextEnv from '@next/env';
import { DomainError } from '../src/lib/domain-error.js';
import { createCustomRequestAttachmentSignedUrl, uploadCustomRequestAttachment } from '../src/services/custom-request.service.js';
import { createSupabaseAdminClient } from '../src/lib/supabase/admin.js';

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

test('uploads a real .stl to Storage with a hardcoded model/stl Content-Type, ignoring any client-declared type', { skip: !process.env.SUPABASE_SERVICE_ROLE_KEY }, async () => {
  const file = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/x-should-be-ignored' });
  const result = await uploadCustomRequestAttachment({ file, fileName: 'sample-model.stl' });
  assert.match(result.path, /^requests\/.+\.stl$/);

  const supabase = createSupabaseAdminClient();
  const publicUrl = supabase.storage.from('custom-request-attachments').getPublicUrl(result.path).data.publicUrl;
  const anonymousResponse = await fetch(publicUrl);
  assert.notEqual(anonymousResponse.status, 200);

  const response = await fetch(await createCustomRequestAttachmentSignedUrl(result.path, 60));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'model/stl');

  await supabase.storage.from('custom-request-attachments').remove([result.path]);
});
