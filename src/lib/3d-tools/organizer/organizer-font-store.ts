/**
 * Phase 45 (D7) — remembers the uploaded label font in this browser only, like the reference
 * (same IndexedDB database/store/key names). Every failure (private window, blocked storage, old data)
 * degrades to "no stored font": the default Inter font is used and the tool keeps working.
 */
const DB_NAME = 'bin-generator-fonts';
const STORE = 'fonts';
const KEY = 'custom';

export type StoredFont = { name: string; bytes: ArrayBuffer };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest | null, read?: (result: unknown) => T): Promise<T | null> {
  const db = await openDb();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(read && request ? read(request.result) : null);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

function isStoredFont(value: unknown): value is StoredFont {
  return typeof value === 'object' && value !== null
    && typeof (value as StoredFont).name === 'string' && (value as StoredFont).bytes instanceof ArrayBuffer;
}

export async function loadStoredFont(): Promise<StoredFont | null> {
  try {
    return await withStore('readonly', (store) => store.get(KEY), (result) => (isStoredFont(result) ? result : null));
  } catch {
    return null;
  }
}

/** Returns false when the browser refused to store it (the font still applies for this visit). */
export async function saveStoredFont(font: StoredFont): Promise<boolean> {
  try {
    await withStore('readwrite', (store) => store.put({ name: font.name, bytes: font.bytes }, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function clearStoredFont(): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(KEY));
  } catch { /* nothing stored, or storage blocked — the default font is used either way */ }
}
