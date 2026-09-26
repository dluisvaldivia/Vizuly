import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/** Same in-memory localStorage as the other controller tests. */
function installStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  vi.stubGlobal('localStorage', {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });
  return store;
}

/**
 * The module reads VITE_SYNC_URL once at import, so each test imports it fresh
 * with the variable already stubbed.
 */
async function loadSync(url = 'https://sync.example') {
  vi.stubEnv('VITE_SYNC_URL', url);
  vi.resetModules();
  return import('./syncController.js');
}

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('syncController', () => {
  it('snapshots profiles, favourites, ratings and every correction, never the pictogram cache', async () => {
    installStorage({
      'vizuly.children.v1': '{"active":"c1","children":[]}',
      'vizuly.favorites.v1': '{"c1":[]}',
      'vizuly.ratings.v1': '{"c1":{"es.cama":2}}',
      'vizuly.correction.v1.es.papá': '31146',
      'vizuly.correction.v1.en.cat': '2458',
      // Derivable and deliberately local: it must not travel.
      'vizuly.pictogram.v1.es.agua': '2248',
      'vizuly.lang': 'es',
    });
    const { snapshot } = await loadSync();

    expect(Object.keys(snapshot().entries).sort()).toEqual([
      'vizuly.children.v1',
      'vizuly.correction.v1.en.cat',
      'vizuly.correction.v1.es.papá',
      'vizuly.favorites.v1',
      'vizuly.ratings.v1',
    ]);
  });

  it('round-trips a snapshot back into storage', async () => {
    const store = installStorage();
    const { applySnapshot } = await loadSync();

    expect(
      applySnapshot({ at: 5, entries: { 'vizuly.favorites.v1': '{"c1":[{"text":"cama","lang":"es"}]}' } }),
    ).toBe(true);
    expect(store.get('vizuly.favorites.v1')).toBe('{"c1":[{"text":"cama","lang":"es"}]}');
  });

  it('ignores a remote snapshot that is not newer than this device', async () => {
    installStorage({ 'vizuly.sync.account.v1': 'a'.repeat(32), 'vizuly.sync.at.v1': '100' });
    const { pull } = await loadSync();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ at: 99, entries: {} }) }));

    expect(await pull()).toBeNull();
  });

  it('does nothing at all with no Worker configured', async () => {
    installStorage({ 'vizuly.sync.account.v1': 'a'.repeat(32) });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { syncAvailable, pull, push } = await loadSync('');

    expect(syncAvailable()).toBe(false);
    expect(await pull()).toBeNull();
    expect(await push()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a failed push is silent and reports false', async () => {
    installStorage({ 'vizuly.sync.account.v1': 'a'.repeat(32) });
    const { push } = await loadSync();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    expect(await push()).toBe(false);
  });
});
