import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { resolve, resolveAll } from './resolve';
import { readCache, writeCache, clearCache } from './cache';
import { setCorrection, readCorrection } from './corrections';
import * as arasaac from './arasaac';
import type { Token } from './types';

/**
 * Minimal in-memory localStorage. The engine must work in Node for tests and in
 * a browser at runtime, and it must survive storage being unavailable.
 */
function installStorage(): Map<string, string> {
  const store = new Map<string, string>();

  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });

  return store;
}

const token = (lookup: string): Token => ({ raw: lookup, normalized: lookup, lookup });

let findSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  installStorage();
  // Tests never hit the live API. See src/aac/CLAUDE.md.
  findSpy = vi.spyOn(arasaac, 'findPictogramId');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('resolve: layer order', () => {
  it('returns from cache without touching the network', async () => {
    writeCache('gato', 'es', 7114);

    await expect(resolve('gato', 'es')).resolves.toBe(7114);
    expect(findSpy).not.toHaveBeenCalled();
  });

  it('returns a cached miss without re-requesting', async () => {
    writeCache('zzz', 'es', null);

    await expect(resolve('zzz', 'es')).resolves.toBeNull();
    expect(findSpy).not.toHaveBeenCalled();
  });

  it('falls through to the API when the cache is empty', async () => {
    findSpy.mockResolvedValue(2248);

    await expect(resolve('agua', 'es')).resolves.toBe(2248);
    expect(findSpy).toHaveBeenCalledWith('agua', 'es', undefined);
  });
});

describe('resolve: the consistency guarantee', () => {
  // This is the whole point of the app. The same word must produce the same
  // symbol forever, even if ARASAAC starts ranking differently.
  it('keeps returning the first answer after ARASAAC ranking changes', async () => {
    findSpy.mockResolvedValueOnce(7114);
    const first = await resolve('gato', 'es');

    // ARASAAC now ranks a different pictogram first.
    findSpy.mockResolvedValue(2406);
    const second = await resolve('gato', 'es');
    const third = await resolve('gato', 'es');

    expect(first).toBe(7114);
    expect(second).toBe(7114);
    expect(third).toBe(7114);
    expect(findSpy).toHaveBeenCalledTimes(1);
  });

  it('writes API results to the cache', async () => {
    findSpy.mockResolvedValue(2248);
    await resolve('agua', 'es');

    expect(readCache('agua', 'es')).toEqual({ hit: true, pictogramId: 2248 });
  });

  it('caches a miss so the word is not re-requested', async () => {
    findSpy.mockResolvedValue(null);
    await resolve('xyzzy', 'es');

    expect(readCache('xyzzy', 'es')).toEqual({ hit: true, pictogramId: null });
  });

  it('keys the cache per language', async () => {
    writeCache('no', 'es', 5526);
    findSpy.mockResolvedValue(5525);

    await expect(resolve('no', 'es')).resolves.toBe(5526);
    await expect(resolve('no', 'en')).resolves.toBe(5525);
  });
});

describe('resolve: overrides beat the API', () => {
  it('uses the shipped papá override instead of calling the API', async () => {
    // Regression guard for the accent collision: bestsearch/papá ranks id 2503
    // ("patata"/"papa", a potato) first, so without this override the child
    // sees a potato for a core vocabulary word. Verified against the live API.
    await expect(resolve('papá', 'es')).resolves.toBe(31146);
    expect(findSpy).not.toHaveBeenCalled();
  });

  it('an override wins even when the API would return something else', async () => {
    findSpy.mockResolvedValue(2503); // the potato

    await expect(resolve('papá', 'es')).resolves.toBe(31146);
    expect(readCache('papá', 'es')).toEqual({ hit: true, pictogramId: 31146 });
  });

  it('a pinned correction overrides a wrong answer already cached', async () => {
    // A word with no shipped override: the API answer gets cached, then an
    // adult corrects it and the correction sticks permanently.
    findSpy.mockResolvedValue(9999);
    await resolve('galleta', 'es');
    expect(readCache('galleta', 'es')).toEqual({ hit: true, pictogramId: 9999 });

    setCorrection('galleta', 'es', { kind: 'pin', pictogramId: 8312 });

    await expect(resolve('galleta', 'es')).resolves.toBe(8312);
  });
});

describe('resolve: failure never breaks the strip', () => {
  // Rule 4: never show nothing. An exception here would show nothing.
  it('returns a miss instead of throwing on network failure', async () => {
    findSpy.mockRejectedValue(new Error('network down'));

    await expect(resolve('agua', 'es')).resolves.toBeNull();
  });

  it('does NOT cache a network failure, so an outage is not permanent', async () => {
    findSpy.mockRejectedValue(new Error('network down'));
    await resolve('agua', 'es');

    expect(readCache('agua', 'es')).toEqual({ hit: false });

    // Network recovers: the word resolves correctly and is cached.
    findSpy.mockResolvedValue(2248);
    await expect(resolve('agua', 'es')).resolves.toBe(2248);
    expect(readCache('agua', 'es')).toEqual({ hit: true, pictogramId: 2248 });
  });

  it('survives localStorage being unavailable', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => {},
      key: () => null,
      length: 0,
    });

    findSpy.mockResolvedValue(2248);
    await expect(resolve('agua', 'es')).resolves.toBe(2248);
  });

  it('treats a corrupt cache entry as absent and re-resolves', async () => {
    localStorage.setItem('vizuly.pictogram.v1.es.agua', 'not-a-number');
    findSpy.mockResolvedValue(2248);

    await expect(resolve('agua', 'es')).resolves.toBe(2248);
  });
});

describe('resolveAll: order is the grammar', () => {
  it('preserves token order regardless of resolution timing', async () => {
    // First word resolves slowly, so a naive implementation would reorder.
    findSpy.mockImplementation(async (word: string) => {
      if (word === 'yo') {
        await new Promise((r) => setTimeout(r, 20));
        return 6479;
      }
      return word === 'querer' ? 5441 : 2248;
    });

    const result = await resolveAll(
      [token('yo'), token('querer'), token('agua')],
      'es',
    );

    expect(result.map((r) => r.token.lookup)).toEqual(['yo', 'querer', 'agua']);
    expect(result.map((r) => r.pictogramId)).toEqual([6479, 5441, 2248]);
  });

  it('keeps a miss in place rather than dropping the word', async () => {
    findSpy.mockImplementation(async (word: string) => (word === 'xyzzy' ? null : 2248));

    const result = await resolveAll([token('agua'), token('xyzzy'), token('agua')], 'es');

    expect(result).toHaveLength(3);
    expect(result[1].pictogramId).toBeNull();
  });

  it('reports which layer answered, for debugging wrong symbols', async () => {
    writeCache('gato', 'es', 7114);
    findSpy.mockResolvedValue(2248);

    const result = await resolveAll([token('gato'), token('agua'), token('xyz')], 'es');
    expect(result[0].source).toBe('cache');
    expect(result[1].source).toBe('api');

    findSpy.mockResolvedValue(null);
    const [miss] = await resolveAll([token('nope')], 'es');
    expect(miss.source).toBe('miss');
  });

  it('returns [] for no tokens', async () => {
    await expect(resolveAll([], 'es')).resolves.toEqual([]);
  });
});

describe('clearCache', () => {
  it('removes pictogram entries but leaves other settings alone', async () => {
    writeCache('gato', 'es', 7114);
    localStorage.setItem('theme', 'dark');

    clearCache();

    expect(readCache('gato', 'es')).toEqual({ hit: false });
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  // Clearing the cache is how an adult recovers from bad API answers. If it
  // also wiped their hand-made fixes, the fix for one wrong symbol would undo
  // every correction they had ever made.
  it('leaves adult corrections alone', async () => {
    setCorrection('galleta', 'es', { kind: 'pin', pictogramId: 8312 });
    writeCache('galleta', 'es', 9999);

    clearCache();

    expect(readCorrection('galleta', 'es')).toEqual({ kind: 'pin', pictogramId: 8312 });
    await expect(resolve('galleta', 'es')).resolves.toBe(8312);
  });
});
