/**
 * Invariants on the reading-mode connector tables.
 *
 * These are not behaviour tests. They hold the structural properties that make
 * reading mode safe to ship, and each one guards a specific way a future edit to
 * connectors.{lang}.json could quietly hurt the child.
 */

import { describe, it, expect, vi } from 'vitest';

import { connectorWords, isStopword, isProtected, lookupConnector } from './lexicon';
import { tokenize } from './tokenize';
import type { Lang, ReadingTier } from './types';

const LANGS: readonly Lang[] = ['es', 'en'];
const TIERS: readonly ReadingTier[] = ['connectors', 'articles', 'clitics'];

describe.each(LANGS)('connector table invariants (%s)', (lang) => {
  const words = connectorWords(lang);

  it('is not empty', () => {
    expect(words.length).toBeGreaterThan(0);
  });

  /**
   * THE load-bearing one.
   *
   * A connector word that is not already a stopword would still be a token in
   * SPEECH mode, reach resolve(), and change the telegraphic output. Reading
   * mode must be additive and invisible while it is off.
   */
  it('every word is already a stopword, so speech mode cannot change', () => {
    const notStopwords = words.filter((word) => !isStopword(word, lang));

    expect(notStopwords).toEqual([]);
  });

  /**
   * PROTECTED_WORDS is what keeps the child hearable when he says "no" or "sí".
   * A protected word in this table could never actually be reached, because
   * isStopword returns false for it first, so it would be a silently dead entry
   * that looks meaningful. Fail loudly instead.
   */
  it('no word is protected core vocabulary', () => {
    const protectedEntries = words.filter((word) => isProtected(word, lang));

    expect(protectedEntries).toEqual([]);
  });

  it('every id is a positive integer', () => {
    const bad = words
      .map((word) => [word, lookupConnector(word, lang, 'clitics')] as const)
      .filter(([, id]) => !Number.isInteger(id) || (id as number) <= 0);

    expect(bad).toEqual([]);
  });

  it('keys are lowercase, matching what normalize() produces', () => {
    expect(words.filter((word) => word !== word.toLowerCase())).toEqual([]);
  });

  it('tiers are cumulative: each tier resolves everything the one below it does', () => {
    for (let i = 1; i < TIERS.length; i += 1) {
      const lower = TIERS[i - 1];
      const higher = TIERS[i];

      for (const word of words) {
        const lowerId = lookupConnector(word, lang, lower);
        if (lowerId === undefined) continue;

        expect(lookupConnector(word, lang, higher)).toBe(lowerId);
      }
    }
  });

  it('speech mode produces no connector token for any of them', () => {
    for (const word of words) {
      expect(tokenize(word, lang).map((t) => t.connectorId)).toEqual([]);
    }
  });
});

describe('an adult ignore still wins in reading mode', () => {
  it('drops a connector the adult silenced', async () => {
    // corrections.ts reads localStorage directly, so give it one.
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

    const { setCorrection } = await import('./corrections');

    expect(tokenize('a casa', 'es', { mode: 'reading', tier: 'connectors' })).toHaveLength(2);

    setCorrection('a', 'es', { kind: 'ignore' });

    // An adult who deliberately silenced a word must not have it come back just
    // because the output mode changed.
    expect(
      tokenize('a casa', 'es', { mode: 'reading', tier: 'connectors' }).map((t) => t.lookup),
    ).toEqual(['casa']);

    vi.unstubAllGlobals();
  });
});
