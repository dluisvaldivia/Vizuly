import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  getInitialFavorites,
  setFavorites,
  favoritesFor,
  isSaved,
  toggleFavorite,
  removeFavorite,
  clearChildFavorites,
} from './favoritesController.js';

/** Same in-memory localStorage as the engine tests. The store must run in Node. */
function installStorage() {
  const store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });
  return store;
}

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('favoritesController', () => {
  it('round-trips through storage', () => {
    const state = toggleFavorite({}, 'c1', 'es', 'cama');
    setFavorites(state);
    expect(getInitialFavorites()).toEqual(state);
  });

  it('returns an empty store rather than throwing on a corrupt value', () => {
    localStorage.setItem('vizuly.favorites.v1', '{not json');
    expect(getInitialFavorites()).toEqual({});
  });

  it('drops a child whose list is not favourites, keeping the others', () => {
    localStorage.setItem(
      'vizuly.favorites.v1',
      JSON.stringify({ c1: [{ text: 'cama', lang: 'es' }], c2: [{ nope: true }] }),
    );
    expect(getInitialFavorites()).toEqual({ c1: [{ text: 'cama', lang: 'es' }] });
  });

  // Deepgram punctuates its transcripts, so the spoken and typed forms of one
  // phrase must be a single favourite.
  it('treats a spoken and a typed form of the same phrase as one favourite', () => {
    const state = toggleFavorite({}, 'c1', 'es', 'Quiero agua.');
    expect(isSaved(state, 'c1', 'es', 'quiero agua')).toBe(true);
    expect(favoritesFor(toggleFavorite(state, 'c1', 'es', 'quiero agua'), 'c1', 'es')).toEqual([]);
  });

  it('keeps accents apart, because sí is not si', () => {
    const state = toggleFavorite({}, 'c1', 'es', 'sí');
    expect(isSaved(state, 'c1', 'es', 'si')).toBe(false);
  });

  it('keeps children apart', () => {
    const state = toggleFavorite({}, 'c1', 'es', 'cama');
    expect(isSaved(state, 'c2', 'es', 'cama')).toBe(false);
    expect(favoritesFor(state, 'c2', 'es')).toEqual([]);
  });

  it('keeps languages apart, because the same text resolves differently', () => {
    const state = toggleFavorite({}, 'c1', 'es', 'no');
    expect(isSaved(state, 'c1', 'en', 'no')).toBe(false);
    expect(favoritesFor(state, 'c1', 'en')).toEqual([]);
  });

  it('saves nothing for text that is only punctuation or space', () => {
    expect(toggleFavorite({}, 'c1', 'es', '   ')).toEqual({});
    expect(toggleFavorite({}, 'c1', 'es', '...')).toEqual({});
  });

  it('keeps the order things were saved in', () => {
    let state = toggleFavorite({}, 'c1', 'es', 'cama');
    state = toggleFavorite(state, 'c1', 'es', 'casa');
    state = toggleFavorite(state, 'c1', 'es', 'hermana');
    expect(favoritesFor(state, 'c1', 'es').map((f) => f.text)).toEqual(['cama', 'casa', 'hermana']);
  });

  it('removes one favourite and clears a child', () => {
    let state = toggleFavorite({}, 'c1', 'es', 'cama');
    state = toggleFavorite(state, 'c1', 'es', 'casa');
    expect(favoritesFor(removeFavorite(state, 'c1', 'es', 'CAMA'), 'c1', 'es').map((f) => f.text)).toEqual(['casa']);
    expect(clearChildFavorites(state, 'c1')).toEqual({});
  });
});
