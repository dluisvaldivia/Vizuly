/**
 * A list of PHRASES -> one resolved pictogram row each, in order.
 *
 * Re-exported through useAac.ts, so the UI still has one seam into the engine.
 *
 * Unlike useWordCards, this DOES go through tokenize(), and that is the whole
 * reason it exists: a favourite can be a whole phrase, and feeding "a la cama"
 * to useWordCards would look up "a" and "la" as words, which returns the LETTER
 * A rather than the connector. Function words must be dropped (or given their
 * connector id in reading mode) exactly as the strip does it, or a favourite
 * would show a different sequence than the phrase it replays.
 *
 * Every row is resolved in ONE resolveAll call and sliced back apart, so a
 * screenful of favourites costs one pass over the cache rather than one per row.
 */

import { useEffect, useMemo, useState } from 'react';

import type { Lang, OutputMode, ReadingTier, ResolvedWord } from './types';
import { tokenize } from './tokenize';
import { resolveAll } from './resolve';

export interface UsePhraseCardsOptions {
  mode?: OutputMode;
  tier?: ReadingTier;
  /** Anything that changes when an adult correction does, so a pin shows at once. */
  revision?: unknown;
}

export interface UsePhraseCardsResult {
  /** Same order and length as the phrases given. A row can be empty: see below. */
  rows: ResolvedWord[][];
  isResolving: boolean;
}

/**
 * A row comes back empty when every word in the phrase was dropped, which is
 * possible for a saved phrase after an adult marks a word `ignore` or changes
 * the reading tier. The caller must render a placeholder for that, never a gap:
 * the child does not read, so a tile with no picture says nothing at all.
 */
export function usePhraseCards(
  phrases: readonly string[],
  lang: Lang,
  options: UsePhraseCardsOptions = {},
): UsePhraseCardsResult {
  const { mode = 'speech', tier = 'connectors', revision } = options;
  const [rows, setRows] = useState<ResolvedWord[][]>([]);
  const [isResolving, setIsResolving] = useState(false);

  // Keyed on the phrases themselves: callers rebuild the array on every render.
  // A newline cannot appear in a favourite, so it is a safe joiner where the
  // pipe useWordCards uses would not be: a phrase may contain one.
  const key = phrases.join('\n');
  const plan = useMemo(() => {
    const texts = key ? key.split('\n') : [];
    const perPhrase = texts.map((text) => tokenize(text, lang, { mode, tier }));
    return { tokens: perPhrase.flat(), lengths: perPhrase.map((t) => t.length) };
  }, [key, lang, mode, tier]);

  useEffect(() => {
    if (plan.tokens.length === 0) {
      // Still one row per phrase, so the caller can render its placeholders.
      setRows(plan.lengths.map(() => []));
      setIsResolving(false);
      return undefined;
    }

    const controller = new AbortController();
    let current = true;
    setIsResolving(true);

    resolveAll(plan.tokens, lang, controller.signal)
      .then((resolved) => {
        if (!current) return;
        let at = 0;
        setRows(
          plan.lengths.map((length) => {
            const row = resolved.slice(at, at + length);
            at += length;
            return row;
          }),
        );
        setIsResolving(false);
      })
      .catch(() => {
        // resolveAll does not throw for misses. An abort or a surprise: never
        // leave the tiles stuck loading.
        if (current) setIsResolving(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [plan, lang, revision]);

  return { rows, isResolving };
}
