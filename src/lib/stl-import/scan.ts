// Feature 003 (FR-001/FR-002/FR-015): which files make up which model. `groupModels` is pure (works
// on a file list) so grouping is tested without a file system; `walkDir` is the thin fs part.
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { normalizeRelPath, type SourceFile } from './source-key';

export type GroupMode = 'FOLDER' | 'FILE';

export type ModelGroup = {
  /** File (FILE mode) or leaf folder (FOLDER mode), relative to the import root. Admin-only. */
  sourceRelPath: string;
  /** Parent folder used for category mapping and the admin filter ('' at the root). */
  sourceDir: string;
  groupMode: GroupMode;
  /** Base name the display name is derived from. */
  nameSource: string;
  files: SourceFile[];
  oversizeSkipped: string[];
};

const MODEL_FILE_RE = /\.stl$/i;

function dirOf(relPath: string): string {
  const index = relPath.lastIndexOf('/');
  return index === -1 ? '' : relPath.slice(0, index);
}

function baseOf(relPath: string): string {
  return relPath.slice(relPath.lastIndexOf('/') + 1);
}

export function matchesOnly(relPath: string, only: string | undefined): boolean {
  if (!only) return true;
  return path.posix.matchesGlob(relPath, only.normalize('NFC'));
}

/**
 * FOLDER (default): every STL in one leaf folder is one multi-part model. A file with no leaf folder
 * of its own — directly in the import root, or loose next to sub-folders that hold models — becomes
 * a model of its own. FILE: one STL, one model.
 */
export function groupModels(files: SourceFile[], mode: GroupMode, options: { maxBytes: number; only?: string }): ModelGroup[] {
  const groups = new Map<string, ModelGroup>();
  const sorted = files
    .map((file) => ({ ...file, relPath: normalizeRelPath(file.relPath) }))
    .filter((file) => MODEL_FILE_RE.test(file.relPath) && matchesOnly(file.relPath, options.only))
    .sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
  // Folders that have a descendant folder holding models are not leaves.
  const nonLeaf = new Set<string>();
  for (const file of sorted) {
    for (let dir = dirOf(dirOf(file.relPath)); ; dir = dirOf(dir)) {
      nonLeaf.add(dir);
      if (dir === '') break;
    }
  }
  for (const file of sorted) {
    const dir = dirOf(file.relPath);
    const byFolder = mode === 'FOLDER' && !nonLeaf.has(dir);
    const key = byFolder ? dir : file.relPath;
    let group = groups.get(key);
    if (!group) {
      group = {
        sourceRelPath: key,
        sourceDir: byFolder ? dirOf(dir) : dir,
        groupMode: byFolder ? 'FOLDER' : 'FILE',
        nameSource: baseOf(key),
        files: [],
        oversizeSkipped: [],
      };
      groups.set(key, group);
    }
    if (file.bytes > options.maxBytes) group.oversizeSkipped.push(file.relPath);
    else group.files.push(file);
  }
  return [...groups.values()];
}

/** Recursive listing of STL files under `root` (dot-entries skipped, symlinks not followed). */
export async function walkDir(root: string): Promise<SourceFile[]> {
  const found: SourceFile[] = [];
  async function visit(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && MODEL_FILE_RE.test(entry.name)) {
        const info = await stat(absolute);
        found.push({ relPath: normalizeRelPath(path.relative(root, absolute)), bytes: info.size, mtimeMs: info.mtimeMs });
      }
    }
  }
  await visit(root);
  return found;
}
