/**
 * Audio kept on the device, in IndexedDB.
 *
 * Only for clips generated live for words outside the pre-generated list. The
 * pre-generated ones are static files and the browser's own HTTP cache handles
 * them; copying those in here would just store the same bytes twice.
 *
 * IndexedDB rather than localStorage because these are binaries: localStorage
 * is strings only and caps out around 5 MB.
 *
 * Every function resolves rather than rejects. Storage can be denied, full, or
 * missing entirely (private windows, old browsers), and none of that is a
 * reason for the child to lose the word he just tapped.
 */

const DB_NAME = 'vizuly-voices';
const DB_VERSION = 1;
const STORE = 'clips';

/**
 * The key carries the voice model, so changing voices does not serve half the
 * vocabulary in one voice and half in another. That inconsistency is exactly
 * what this whole feature exists to remove.
 */
export function clipKey(model: string, lang: string, word: string, mode: string): string {
  return `${model}.${lang}.${word}.${mode}`;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      // Another tab holding an old version open. Give up rather than hang.
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getClip(key: string): Promise<Blob | null> {
  const db = await openDb();
  if (db === null) return null;

  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as Blob) ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    } finally {
      db.close();
    }
  });
}

export async function putClip(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  if (db === null) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      // Quota exceeded, most likely. Nothing to do about it and nothing to say.
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    } finally {
      db.close();
    }
  });
}

/**
 * Wipes the downloaded audio.
 *
 * Reached from "forget saved pictograms" in the adult panel, because an adult
 * reads that button as "forget what you have saved", and audio he did not ask
 * for is part of that. The pre-generated clips are untouched: they are part of
 * the app, not something it saved.
 */
export async function clearClips(): Promise<void> {
  const db = await openDb();
  if (db === null) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    } finally {
      db.close();
    }
  });
}
