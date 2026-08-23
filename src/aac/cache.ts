/**
 * The consistency guarantee.
 *
 * Every resolved word -> pictogram id pair is written here and read from here
 * first. This is what makes the same word produce the same symbol forever, even
 * if ARASAAC's ranking changes underneath us.
 *
 * It is a hard requirement, not a performance optimisation.
 *
 * NEVER add an expiry, a TTL, or a "refresh stale entries" pass. A word must map
 * to the same pictogram permanently. See src/aac/CLAUDE.md.
 */

import type { Lang } from './types';

/** Versioned so a future format change cannot silently misread old entries. */
const CACHE_PREFIX = 'vizuly.pictogram.v1';

/**
 * A cached miss. Distinct from "absent" so we do not re-request a word we
 * already know ARASAAC has no symbol for.
 */
const MISS_SENTINEL = 'miss';

/** Cache keys are per language: "gato" resolves differently in es and en. */
function cacheKey(word: string, lang: Lang): string {
  return `${CACHE_PREFIX}.${lang}.${word}`;
}

/**
 * localStorage access can throw: Safari private mode, disabled site data, or a
 * full quota. None of those should break the app, so every access is guarded.
 *
 * Failing to cache degrades consistency, which matters, but crashing denies the
 * child the app entirely. Degrade.
 */
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or storage unavailable. Nothing useful to do: the lookup
    // still returns a correct answer, it just will not be remembered.
  }
}

/** What the cache knows about a word. */
export type CacheHit =
  | { hit: true; pictogramId: number | null }
  | { hit: false };

/**
 * Read a cached resolution.
 *
 * Returns `{ hit: false }` when the word has never been resolved, and
 * `{ hit: true, pictogramId: null }` when it was resolved to a known miss.
 * Those two are different and the caller must not conflate them.
 */
export function readCache(word: string, lang: Lang): CacheHit {
  const raw = safeGet(cacheKey(word, lang));

  if (raw === null) return { hit: false };
  if (raw === MISS_SENTINEL) return { hit: true, pictogramId: null };

  const id = Number.parseInt(raw, 10);

  // Corrupt entry, for example hand-edited or written by an older format.
  // Treat as absent so it gets re-resolved and overwritten cleanly.
  if (!Number.isInteger(id)) return { hit: false };

  return { hit: true, pictogramId: id };
}

/** Record a resolution, including a miss. */
export function writeCache(word: string, lang: Lang, pictogramId: number | null): void {
  safeSet(cacheKey(word, lang), pictogramId === null ? MISS_SENTINEL : String(pictogramId));
}

/**
 * Overwrite one entry with a known-correct id.
 *
 * This is the correction mechanism: when a word shows the wrong pictogram, an
 * adult pins the right one and it sticks permanently. In v2 this store syncs to
 * SQLite across devices.
 */
export function pinCorrection(word: string, lang: Lang, pictogramId: number): void {
  writeCache(word, lang, pictogramId);
}

/**
 * Remove every cached pictogram, leaving other app settings alone.
 *
 * Adult-only escape hatch for when the cache has accumulated wrong answers.
 * Deliberately explicit: nothing calls this automatically.
 */
export function clearCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage unavailable. Nothing to clear.
  }
}
