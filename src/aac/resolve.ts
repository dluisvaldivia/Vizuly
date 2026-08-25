/**
 * word -> pictogram id, cache-first.
 *
 * THIS IS THE v2 SWAP POINT. `resolve(word, lang)` must stay clean enough that
 * replacing this implementation with a server call is a one-file change touching
 * no UI code. Do not leak cache mechanics, ARASAAC response shapes, or network
 * state through its signature.
 */

import type { Lang, ResolvedWord, Token } from './types';
import { readCache, writeCache } from './cache';
import { readCorrection } from './corrections';
import { findPictogramId } from './arasaac';

import overridesEs from './data/overrides.es.json';
import overridesEn from './data/overrides.en.json';

/** JSON comment keys, stripped at load. Lets the data files document themselves. */
const COMMENT_KEY = '_comment';

function buildOverrides(map: Record<string, unknown>): ReadonlyMap<string, number> {
  const entries = Object.entries(map)
    .filter(([key]) => key !== COMMENT_KEY)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number');

  return new Map(entries);
}

const OVERRIDES: Record<Lang, ReadonlyMap<string, number>> = {
  es: buildOverrides(overridesEs),
  en: buildOverrides(overridesEn),
};

/**
 * Resolve one word to a pictogram id.
 *
 * Four layers, strict order, stop at the first hit:
 *
 *   0. Correction an adult fixed this word inside the app. Beats everything
 *   1. Cache      already known, returns directly, no network
 *   2. Overrides  hand-curated correct answers, beats the API by design
 *   3. API        ARASAAC bestsearch, then search
 *
 * Results from layers 2 and 3 are written to the cache before returning, which
 * is what makes the answer permanent.
 *
 * Returns null for a miss. Never throws: a network failure returns a miss so the
 * strip still renders a placeholder rather than breaking. Rule 4 says never show
 * nothing, and an exception here would show nothing.
 */
export async function resolve(
  word: string,
  lang: Lang,
  signal?: AbortSignal,
): Promise<number | null> {
  // Layer 0: an adult correction made inside the app. Above the cache on
  // purpose: the cache is usually holding the very answer being corrected, and
  // a correction that lost to it would appear to do nothing. See corrections.ts.
  //
  // An 'ignore' word never reaches here, tokenize drops it. A 'flag' is a note
  // for the adult and deliberately changes nothing about resolution.
  const correction = readCorrection(word, lang);
  if (correction?.kind === 'pin') return correction.pictogramId;

  // Layer 1: cache. A hit is returned verbatim, including
  // a cached miss, so we never re-request a word we already know has no symbol.
  const cached = readCache(word, lang);
  if (cached.hit) return cached.pictogramId;

  // Layer 2: overrides. Beats the API deliberately. This is how a wrong symbol
  // gets fixed permanently, and why no ranking heuristic is needed.
  const override = OVERRIDES[lang].get(word);
  if (override !== undefined) {
    writeCache(word, lang, override);
    return override;
  }

  // Layer 3: the API.
  try {
    const id = await findPictogramId(word, lang, signal);
    writeCache(word, lang, id);
    return id;
  } catch {
    // Network failure, timeout, or 5xx. Return a miss so the child sees a
    // placeholder rather than a broken strip.
    //
    // Deliberately NOT cached: this says nothing about whether the word has a
    // pictogram, only that we could not reach ARASAAC. Caching it would make a
    // transient outage permanent, which is exactly the bug the cache's
    // no-expiry rule would then prevent us from repairing.
    return null;
  }
}

/**
 * Resolve a sequence of tokens, preserving order.
 *
 * Order is the grammar: the strip reads left to right and that is what carries
 * the meaning. Requests run in parallel because they are independent, and the
 * results are reassembled positionally.
 */
export async function resolveAll(
  tokens: readonly Token[],
  lang: Lang,
  signal?: AbortSignal,
): Promise<ResolvedWord[]> {
  return Promise.all(
    tokens.map(async (token) => {
      const before = readCache(token.lookup, lang);
      const pictogramId = await resolve(token.lookup, lang, signal);

      return {
        token,
        pictogramId,
        source: describeSource(before.hit, pictogramId, token.lookup, lang),
      };
    }),
  );
}

/**
 * Which layer produced the answer. Diagnostic only, never shown to the child.
 *
 * Exists so that when a wrong symbol appears it is immediately obvious whether
 * the cache, the overrides map, or the API is responsible.
 */
function describeSource(
  wasCached: boolean,
  pictogramId: number | null,
  word: string,
  lang: Lang,
): ResolvedWord['source'] {
  // Checked first because it is checked first in resolve(), and because the fix
  // dialog shows it: an adult needs to see that the symbol in front of them is
  // one they pinned, not one ARASAAC chose.
  if (readCorrection(word, lang)?.kind === 'pin') return 'correction';
  if (wasCached) return 'cache';
  if (pictogramId === null) return 'miss';
  if (OVERRIDES[lang].has(word)) return 'override';
  return 'api';
}
