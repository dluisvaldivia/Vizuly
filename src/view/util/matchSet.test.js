import { describe, it, expect } from 'vitest';

import { pictogramIdSet, isFullSetMatch, intersectingIds } from './matchSet';

const word = (pictogramId) => ({ pictogramId });

describe('pictogramIdSet', () => {
  it('dedupes repeated pictogram ids', () => {
    const set = pictogramIdSet([word(1), word(2), word(1)]);
    expect(set).toEqual(new Set([1, 2]));
  });

  it('drops misses (null pictogramId)', () => {
    const set = pictogramIdSet([word(1), word(null), word(2)]);
    expect(set).toEqual(new Set([1, 2]));
  });

  it('is empty for an empty word list', () => {
    expect(pictogramIdSet([])).toEqual(new Set());
  });
});

describe('isFullSetMatch', () => {
  it('matches the same ids in a different order', () => {
    expect(isFullSetMatch(new Set([1, 2, 3]), new Set([3, 1, 2]))).toBe(true);
  });

  it('matches when a repeated word collapses to the same underlying set', () => {
    // "perro perro" resolves to one id repeated; the set is still {perro}.
    const held = pictogramIdSet([word(5)]);
    const live = pictogramIdSet([word(5), word(5)]);
    expect(isFullSetMatch(held, live)).toBe(true);
  });

  it('does not match when an id is missing', () => {
    expect(isFullSetMatch(new Set([1, 2]), new Set([1]))).toBe(false);
  });

  it('does not match when live is a superset of held', () => {
    expect(isFullSetMatch(new Set([1, 2]), new Set([1, 2, 3]))).toBe(false);
  });

  it('does not match when held is a superset of live', () => {
    expect(isFullSetMatch(new Set([1, 2, 3]), new Set([1, 2]))).toBe(false);
  });

  it('does not match when both are empty', () => {
    expect(isFullSetMatch(new Set(), new Set())).toBe(false);
  });

  it('does not match when held is empty', () => {
    expect(isFullSetMatch(new Set(), new Set([1]))).toBe(false);
  });

  it('does not match when live is empty', () => {
    expect(isFullSetMatch(new Set([1]), new Set())).toBe(false);
  });
});

describe('intersectingIds', () => {
  it('returns only the shared ids', () => {
    expect(intersectingIds(new Set([1, 2, 3]), new Set([2, 3, 4]))).toEqual(new Set([2, 3]));
  });

  it('is empty when nothing overlaps', () => {
    expect(intersectingIds(new Set([1]), new Set([2]))).toEqual(new Set());
  });

  it('is empty when either side is empty', () => {
    expect(intersectingIds(new Set(), new Set([1]))).toEqual(new Set());
    expect(intersectingIds(new Set([1]), new Set())).toEqual(new Set());
  });
});
