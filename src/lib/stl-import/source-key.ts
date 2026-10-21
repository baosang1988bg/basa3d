// Feature 003 (research R1/R8): stable identity of an imported model. Pure — shared by the import
// script and the services. macOS returns file names in NFD and Windows uses `\`, so the same Drive
// file must normalise to one key on both, or a re-run on the other machine would create duplicates.
import { createHash } from 'node:crypto';

export type SourceFile = { relPath: string; bytes: number; mtimeMs: number };

export function normalizeRelPath(relPath: string): string {
  return relPath
    .split(/[\\/]+/)
    .filter((segment) => segment !== '' && segment !== '.')
    .join('/')
    .normalize('NFC');
}

/** sha1 hex (40 chars) of the normalised path — matches `source_key ~ '^[0-9a-f]{40}$'`. */
export function sourceKey(relPath: string): string {
  return createHash('sha1').update(normalizeRelPath(relPath), 'utf8').digest('hex');
}

/** Sorted, normalised file list: what `source_files` stores and what a re-run compares. */
export function fingerprintFiles(files: SourceFile[]): SourceFile[] {
  return files
    .map((file) => ({ relPath: normalizeRelPath(file.relPath), bytes: file.bytes, mtimeMs: Math.round(file.mtimeMs) }))
    .sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
}

export function sameFingerprint(a: SourceFile[], b: SourceFile[]): boolean {
  const left = fingerprintFiles(a);
  const right = fingerprintFiles(b);
  return left.length === right.length
    && left.every((file, index) => file.relPath === right[index].relPath && file.bytes === right[index].bytes && file.mtimeMs === right[index].mtimeMs);
}
