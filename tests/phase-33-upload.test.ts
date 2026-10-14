// Phase 33 S2 — direct-to-Storage uploads (plan §6.2, §6.3 step 2), TOO_LARGE estimate, orphan cron.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { DomainError } from '../src/lib/domain-error.js';
import { uploadUrlsRequestSchema } from '../src/domain/schemas.js';
import { CONTENT_TYPE_BY_EXTENSION, MAX_UPLOAD_BYTES, UPLOAD_EXTENSIONS } from '../src/config/uploads.js';
import {
  createCustomRequestUploadTargets,
  inspectUploadedObject,
  matchesMagicBytes,
  type UploadedObjectStorage,
} from '../src/services/custom-request.service.js';
import { estimateAttachment } from '../src/services/file-estimate.service.js';
import { isAuthorizedCronRequest } from '../src/lib/cron-auth.js';
import { cleanupOrphanUploads } from '../src/services/orphan-upload-cleanup.service.js';
import { GET as cronGet } from '../src/app/api/cron/cleanup-orphan-uploads/route.js';

configureTestEnvironment();
process.env.UPLOAD_CLAIM_SECRET ??= 'phase-34-upload-claim-test-secret-at-least-32-characters';

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

function binaryStl(triangles: number): Uint8Array {
  const out = new Uint8Array(84 + triangles * 50);
  out.set(text('solid but actually binary — exporters do this'), 0); // header may start with "solid"
  new DataView(out.buffer).setUint32(80, triangles, true);
  return out;
}

// ---------------------------------------------------------------------------------------------
// upload-urls request schema + targets
// ---------------------------------------------------------------------------------------------

test('uploadUrlsRequestSchema: 1–10 files, known extensions only, size ≤ MAX_UPLOAD_BYTES, strict', () => {
  const file = { ext: 'stl', sizeBytes: 1_000 };
  assert.equal(uploadUrlsRequestSchema.safeParse({ files: [file] }).success, true);
  assert.equal(uploadUrlsRequestSchema.safeParse({ files: Array.from({ length: 10 }, () => file) }).success, true);
  assert.equal(uploadUrlsRequestSchema.safeParse({ files: Array.from({ length: 11 }, () => file) }).success, false);
  assert.equal(uploadUrlsRequestSchema.safeParse({ files: [] }).success, false);
  for (const ext of ['exe', 'blend', 'html', 'svg', '../stl', '']) {
    assert.equal(uploadUrlsRequestSchema.safeParse({ files: [{ ext, sizeBytes: 1 }] }).success, false, ext);
  }
  assert.equal(uploadUrlsRequestSchema.safeParse({ files: [{ ext: 'stl', sizeBytes: MAX_UPLOAD_BYTES }] }).success, true);
  assert.equal(uploadUrlsRequestSchema.safeParse({ files: [{ ext: 'stl', sizeBytes: MAX_UPLOAD_BYTES + 1 }] }).success, false);
  assert.equal(uploadUrlsRequestSchema.safeParse({ files: [{ ext: 'stl', sizeBytes: 0 }] }).success, false);
  assert.equal(uploadUrlsRequestSchema.safeParse({ files: [{ ext: 'stl', sizeBytes: 1.5 }] }).success, false);
  // Client cannot pick the path or the content type.
  assert.equal(uploadUrlsRequestSchema.safeParse({ files: [{ ...file, path: 'requests/x.stl' }] }).success, false);
  assert.equal(uploadUrlsRequestSchema.safeParse({ files: [{ ...file, contentType: 'text/html' }] }).success, false);
  assert.equal(uploadUrlsRequestSchema.parse({ files: [{ ext: ' STL ', sizeBytes: 1 }] }).files[0].ext, 'stl');
});

test('createCustomRequestUploadTargets: server-generated random paths + contentType from the extension map', async () => {
  const signed: string[] = [];
  const sign = async (path: string) => { signed.push(path); return { token: `token-for-${path}` }; };
  const targets = await createCustomRequestUploadTargets(UPLOAD_EXTENSIONS.map((ext) => ({ ext })), { sign });
  assert.equal(targets.length, UPLOAD_EXTENSIONS.length);
  for (const [index, target] of targets.entries()) {
    const ext = UPLOAD_EXTENSIONS[index];
    assert.match(target.path, new RegExp(`^requests/[0-9a-f-]{36}\\.${ext}$`));
    assert.equal(target.contentType, CONTENT_TYPE_BY_EXTENSION[ext]);
    assert.equal(target.token, `token-for-${target.path}`);
    assert.equal(typeof target.uploadClaim, 'string');
  }
  assert.equal(new Set(signed).size, signed.length, 'every path is unique');
  const stl = targets[UPLOAD_EXTENSIONS.indexOf('stl')];
  assert.equal(stl.contentType, 'model/stl');
});

// ---------------------------------------------------------------------------------------------
// magic bytes
// ---------------------------------------------------------------------------------------------

test('matchesMagicBytes: 3mf needs a ZIP header', () => {
  assert.equal(matchesMagicBytes('3mf', bytes(0x50, 0x4b, 0x03, 0x04, 0x14), 5), true);
  assert.equal(matchesMagicBytes('3mf', text('<html>'), 6), false);
});

test('matchesMagicBytes: STL binary by exact length formula, ASCII by leading "solid"', () => {
  const stl = binaryStl(3);
  assert.equal(matchesMagicBytes('stl', stl.subarray(0, 512), stl.length), true);
  // Binary header that says "solid" but the length doesn't match and the body isn't text → reject.
  assert.equal(matchesMagicBytes('stl', stl.subarray(0, 512), stl.length + 7), false);
  const ascii = text('solid cube\n  facet normal 0 0 1\n    outer loop\n');
  assert.equal(matchesMagicBytes('stl', ascii, ascii.length), true);
  assert.equal(matchesMagicBytes('stl', text('﻿  solid cube\nfacet'), 30), true);
  assert.equal(matchesMagicBytes('stl', text('<!doctype html><script>'), 23), false);
  assert.equal(matchesMagicBytes('stl', bytes(1, 2, 3), 3), false);
});

test('matchesMagicBytes: OBJ is text, STEP starts with ISO-10303-21', () => {
  assert.equal(matchesMagicBytes('obj', text('# Blender\nv 0 0 0\nf 1 2 3\n'), 25), true);
  assert.equal(matchesMagicBytes('obj', bytes(0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01), 6), false); // ELF
  assert.equal(matchesMagicBytes('step', text('ISO-10303-21;\nHEADER;'), 21), true);
  assert.equal(matchesMagicBytes('stp', text('\r\nISO-10303-21;'), 16), true);
  assert.equal(matchesMagicBytes('step', text('# not a step file'), 17), false);
});

test('matchesMagicBytes: JPEG / PNG / WebP signatures', () => {
  assert.equal(matchesMagicBytes('jpg', bytes(0xff, 0xd8, 0xff, 0xe0), 4), true);
  assert.equal(matchesMagicBytes('jpeg', bytes(0xff, 0xd8, 0xff, 0xdb), 4), true);
  assert.equal(matchesMagicBytes('png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 8), true);
  assert.equal(matchesMagicBytes('webp', text('RIFF\0\0\0\0WEBPVP8 '), 16), true);
  assert.equal(matchesMagicBytes('png', bytes(0xff, 0xd8, 0xff, 0xe0), 4), false);
  assert.equal(matchesMagicBytes('webp', text('RIFF\0\0\0\0AVI '), 12), false);
  assert.equal(matchesMagicBytes('exe', bytes(0x4d, 0x5a), 2), false);
});

// ---------------------------------------------------------------------------------------------
// inspectUploadedObject
// ---------------------------------------------------------------------------------------------

type FakeObject = Uint8Array | { size: number; head: Uint8Array; contentType?: string | null };

function fakeStorage(objects: Record<string, FakeObject>): UploadedObjectStorage & { reads: number[] } {
  const reads: number[] = [];
  return {
    reads,
    async stat(path) {
      const object = objects[path];
      if (!object) return null;
      const ext = path.split('.').pop() as keyof typeof CONTENT_TYPE_BY_EXTENSION;
      if (object instanceof Uint8Array) return { size: object.length, contentType: CONTENT_TYPE_BY_EXTENSION[ext] };
      return { size: object.size, contentType: object.contentType === undefined ? CONTENT_TYPE_BY_EXTENSION[ext] : object.contentType };
    },
    async readHead(path, length) {
      reads.push(length);
      const object = objects[path];
      const data = object instanceof Uint8Array ? object : object.head;
      return data.subarray(0, length);
    },
  };
}

const pathFor = (ext: string) => `requests/${randomUUID()}.${ext}`;
const rejectsWith = (code: string) => (error: unknown) => error instanceof DomainError && error.code === code && error.status === 400;

test('inspectUploadedObject accepts a real object and reads only the first bytes', async () => {
  const path = pathFor('stl');
  const stl = binaryStl(2_000);
  const storage = fakeStorage({ [path]: stl });
  assert.deepEqual(await inspectUploadedObject(path, storage), { sizeBytes: stl.length });
  assert.deepEqual(storage.reads, [512]);
});

test('inspectUploadedObject: missing object / wrong magic bytes / too large / empty / bad path → 400', async () => {
  const missing = pathFor('stl');
  await assert.rejects(inspectUploadedObject(missing, fakeStorage({})), rejectsWith('ATTACHMENT_NOT_FOUND'));

  const html = pathFor('3mf');
  await assert.rejects(inspectUploadedObject(html, fakeStorage({ [html]: text('<html><script>alert(1)</script></html>') })), rejectsWith('ATTACHMENT_CONTENT_MISMATCH'));

  const big = pathFor('3mf');
  await assert.rejects(
    inspectUploadedObject(big, fakeStorage({ [big]: { size: MAX_UPLOAD_BYTES + 1, head: bytes(0x50, 0x4b, 0x03, 0x04) } })),
    rejectsWith('FILE_TOO_LARGE'),
  );

  const empty = pathFor('png');
  await assert.rejects(inspectUploadedObject(empty, fakeStorage({ [empty]: new Uint8Array(0) })), rejectsWith('EMPTY_FILE'));

  // Right bytes, but stored with a different Content-Type than the extension maps to.
  const spoofed = pathFor('stl');
  const stl = binaryStl(1);
  await assert.rejects(
    inspectUploadedObject(spoofed, fakeStorage({ [spoofed]: { size: stl.length, head: stl, contentType: 'image/jpeg' } })),
    rejectsWith('ATTACHMENT_CONTENT_MISMATCH'),
  );
  const charset = pathFor('stl');
  assert.deepEqual(
    await inspectUploadedObject(charset, fakeStorage({ [charset]: { size: stl.length, head: stl, contentType: 'model/stl; charset=binary' } })),
    { sizeBytes: stl.length },
  );

  for (const bad of ['../secret.stl', 'requests/../x.stl', 'products/abc.stl', 'requests/abc.exe']) {
    await assert.rejects(inspectUploadedObject(bad, fakeStorage({})), rejectsWith('INVALID_ATTACHMENT_PATH'));
  }
});

// ---------------------------------------------------------------------------------------------
// TOO_LARGE estimate (ADR-0034 parse cap 20MB < upload cap 50MB)
// ---------------------------------------------------------------------------------------------

test('estimateAttachment returns TOO_LARGE for a stored file above the 20MB parse cap, without downloading it', async () => {
  let downloaded = false;
  const result = await estimateAttachment(pathFor('stl'), null, {
    size: async () => 25 * 1024 * 1024,
    download: async () => { downloaded = true; return new Uint8Array(); },
  });
  assert.deepEqual(result, { status: 'TOO_LARGE', estimate: null });
  assert.equal(downloaded, false);
});

test('estimateAttachment: a missing stored object is a 404, not an estimate', async () => {
  await assert.rejects(
    estimateAttachment(pathFor('stl'), null, { size: async () => null }),
    (error: unknown) => error instanceof DomainError && error.code === 'ATTACHMENT_NOT_FOUND' && error.status === 404,
  );
});

test('estimateAttachment maps a FILE_TOO_LARGE download error to TOO_LARGE instead of throwing', { skip: !process.env.DATABASE_URL }, async () => {
  const result = await estimateAttachment(pathFor('stl'), null, {
    download: async () => { throw new DomainError('FILE_TOO_LARGE', 'too large', 400); },
  });
  assert.ok(result.status === 'TOO_LARGE' || result.status === 'NO_PRICING_CONFIG');
});

// ---------------------------------------------------------------------------------------------
// Cron auth + cleanup
// ---------------------------------------------------------------------------------------------

const SECRET = 'cron-secret-for-tests-0123456789';

test('isAuthorizedCronRequest fails closed', () => {
  assert.equal(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET), true);
  assert.equal(isAuthorizedCronRequest(null, SECRET), false);
  assert.equal(isAuthorizedCronRequest('', SECRET), false);
  assert.equal(isAuthorizedCronRequest(`Bearer ${SECRET}x`, SECRET), false);
  assert.equal(isAuthorizedCronRequest(SECRET, SECRET), false);
  assert.equal(isAuthorizedCronRequest('Bearer ', ''), false);
  assert.equal(isAuthorizedCronRequest('Bearer undefined', undefined), false);
  assert.equal(isAuthorizedCronRequest('Bearer short', 'short'), false); // secret too short → never authorized
});

test('GET /api/cron/cleanup-orphan-uploads returns 401 for a missing or wrong secret (before any work)', async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
  try {
    const missing = await cronGet(new Request('http://localhost/api/cron/cleanup-orphan-uploads'));
    assert.equal(missing.status, 401);
    const wrong = await cronGet(new Request('http://localhost/api/cron/cleanup-orphan-uploads', { headers: { authorization: 'Bearer nope' } }));
    assert.equal(wrong.status, 401);
    delete process.env.CRON_SECRET;
    const unset = await cronGet(new Request('http://localhost/api/cron/cleanup-orphan-uploads', { headers: { authorization: `Bearer ${SECRET}` } }));
    assert.equal(unset.status, 401);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous;
  }
});

test('cleanupOrphanUploads deletes found orphans in bounded batches and survives a failed batch', async () => {
  const orphans = Array.from({ length: 250 }, () => pathFor('stl'));
  const removed: string[][] = [];
  let calls = 0;
  const result = await cleanupOrphanUploads({
    deleteLimit: 250,
    deps: {
      findOrphans: async (limit) => orphans.slice(0, limit),
      remove: async (paths) => {
        calls += 1;
        if (calls === 2) throw new Error('storage hiccup');
        removed.push(paths);
      },
    },
  });
  assert.deepEqual(removed.map((batch) => batch.length), [100, 50]);
  assert.deepEqual(result, { found: 250, deleted: 150, failedBatches: 1 });
});
