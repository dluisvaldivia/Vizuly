import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  exportCorrections,
  exportPins,
  isIgnored,
  listCorrections,
  readCorrection,
  removeCorrection,
  setCorrection,
} from './corrections';
import { tokenize } from './tokenize';
import { isStopword } from './lexicon';

/** Same in-memory localStorage as resolve.test.ts. The engine must run in Node. */
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

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the store', () => {
  it('round-trips each kind', () => {
    setCorrection('lion', 'en', { kind: 'pin', pictogramId: 2453 });
    setCorrection('my', 'en', { kind: 'ignore' });
    setCorrection('llamo', 'es', { kind: 'flag' });

    expect(readCorrection('lion', 'en')).toEqual({ kind: 'pin', pictogramId: 2453 });
    expect(readCorrection('my', 'en')).toEqual({ kind: 'ignore' });
    expect(readCorrection('llamo', 'es')).toEqual({ kind: 'flag' });
  });

  it('keeps languages apart, because the same word means different things', () => {
    setCorrection('no', 'es', { kind: 'pin', pictogramId: 111 });

    expect(readCorrection('no', 'en')).toBeNull();
  });

  it('returns null for a corrupt entry rather than a bogus pictogram id', () => {
    localStorage.setItem('vizuly.correction.v1.es.gato', 'pin:not-a-number');

    expect(readCorrection('gato', 'es')).toBeNull();
  });

  it('is undoable', () => {
    setCorrection('lion', 'en', { kind: 'pin', pictogramId: 2453 });
    removeCorrection('lion', 'en');

    expect(readCorrection('lion', 'en')).toBeNull();
  });

  it('lists every correction with its language', () => {
    setCorrection('lion', 'en', { kind: 'pin', pictogramId: 2453 });
    setCorrection('papá', 'es', { kind: 'flag' });

    expect(listCorrections()).toEqual([
      { word: 'lion', lang: 'en', correction: { kind: 'pin', pictogramId: 2453 } },
      { word: 'papá', lang: 'es', correction: { kind: 'flag' } },
    ]);
  });

  it('exports only pins, in overrides.json shape', () => {
    setCorrection('lion', 'en', { kind: 'pin', pictogramId: 2453 });
    setCorrection('my', 'en', { kind: 'ignore' });
    setCorrection('papá', 'es', { kind: 'pin', pictogramId: 31146 });

    expect(exportPins('en')).toEqual({ lion: 2453 });
    expect(exportPins('es')).toEqual({ papá: 31146 });
  });

  // localStorage is invisible from outside the browser it lives in, so this
  // text is the only way a flag reaches anyone who can act on it.
  it('exports all three kinds, both languages, as pasteable text', () => {
    setCorrection('lion', 'es', { kind: 'pin', pictogramId: 2485 });
    setCorrection('llamo', 'es', { kind: 'ignore' });
    setCorrection('papá', 'es', { kind: 'flag' });
    setCorrection('cookie', 'en', { kind: 'flag' });

    const exported = JSON.parse(exportCorrections());

    expect(exported.es).toEqual({
      pins: { lion: 2485 },
      ignored: ['llamo'],
      flagged: ['papá'],
    });
    expect(exported.en).toEqual({ pins: {}, ignored: [], flagged: ['cookie'] });
    expect(typeof exported.exported).toBe('string');
  });

  it('exports empty sections rather than omitting a language', () => {
    const exported = JSON.parse(exportCorrections());

    expect(exported.es).toEqual({ pins: {}, ignored: [], flagged: [] });
    expect(exported.en).toEqual({ pins: {}, ignored: [], flagged: [] });
  });

  it('survives storage being unavailable', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(() => setCorrection('agua', 'es', { kind: 'ignore' })).not.toThrow();
    expect(readCorrection('agua', 'es')).toBeNull();
    expect(listCorrections()).toEqual([]);
  });
});

describe('ignore', () => {
  // Closes a gap in the shipped stopword list without a code change, which is
  // the whole point: the adult finds these in use, at home, not at a keyboard.
  it('drops the word from the strip, like a stopword', () => {
    expect(tokenize('my name is lion', 'en').map((t) => t.lookup)).toEqual(['name', 'lion']);

    setCorrection('name', 'en', { kind: 'ignore' });

    expect(tokenize('my name is lion', 'en').map((t) => t.lookup)).toEqual(['lion']);
    expect(isIgnored('name', 'en')).toBe(true);
    expect(isStopword('name', 'en')).toBe(true);
  });

  // A child who cannot be heard saying "no" has lost the thing the app is for.
  // PROTECTED_WORDS is structural, so a mistaken tap cannot silence the child.
  it('cannot silence protected core vocabulary', () => {
    setCorrection('no', 'es', { kind: 'ignore' });
    setCorrection('sí', 'es', { kind: 'ignore' });

    expect(isStopword('no', 'es')).toBe(false);
    expect(tokenize('no quiero', 'es').map((t) => t.lookup)).toEqual(['no', 'querer']);
    expect(tokenize('sí', 'es').map((t) => t.lookup)).toEqual(['sí']);
  });
});

describe('flag', () => {
  it('changes nothing the child sees', () => {
    setCorrection('lion', 'en', { kind: 'flag' });

    expect(isStopword('lion', 'en')).toBe(false);
    expect(tokenize('lion', 'en').map((t) => t.lookup)).toEqual(['lion']);
  });
});
