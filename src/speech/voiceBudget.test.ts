import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { DAILY_LIMIT, canSpend, remainingToday, spend, usedToday } from './voiceBudget';

/** Same in-memory localStorage as the engine tests. */
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

let store: Map<string, string>;

beforeEach(() => {
  store = installStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const KEY = 'vizuly.voiceBudget.v1';

describe('the daily budget', () => {
  it('starts the day with the whole allowance', () => {
    expect(remainingToday()).toBe(DAILY_LIMIT);
    expect(usedToday()).toBe(0);
    expect(canSpend()).toBe(true);
  });

  it('counts calls down', () => {
    spend();
    spend();
    expect(usedToday()).toBe(2);
    expect(remainingToday()).toBe(DAILY_LIMIT - 2);
  });

  it('refuses once the allowance is gone', () => {
    spend(DAILY_LIMIT);
    expect(canSpend()).toBe(false);
    expect(remainingToday()).toBe(0);
  });

  it('never reports a negative remainder', () => {
    spend(DAILY_LIMIT + 10);
    expect(remainingToday()).toBe(0);
    expect(usedToday()).toBe(DAILY_LIMIT);
  });

  it('starts over on a new day', () => {
    spend(DAILY_LIMIT);
    expect(canSpend()).toBe(false);

    store.set(KEY, JSON.stringify({ day: '2020-01-01', calls: DAILY_LIMIT }));
    expect(canSpend()).toBe(true);
    expect(remainingToday()).toBe(DAILY_LIMIT);
  });

  it('ignores a corrupt entry rather than throwing', () => {
    store.set(KEY, 'not json');
    expect(remainingToday()).toBe(DAILY_LIMIT);

    store.set(KEY, JSON.stringify({ day: 5, calls: 'many' }));
    expect(remainingToday()).toBe(DAILY_LIMIT);
  });

  it('refuses to spend when storage is unavailable, because then nothing counts', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {},
      key: () => null,
      length: 0,
    });

    expect(canSpend()).toBe(false);
  });
});
