/**
 * A list of card words -> resolved pictograms, one per word, in order.
 *
 * Re-exported through useAac.ts, so the UI still has one seam into the engine.
 *
 * Deliberately does not go through tokenize(). A card is a word an adult chose
 * on purpose, so a stopword or an ignored word still gets its card: dropping it
 * would be a silent skip, which rule 4 forbids. The lemma map still applies, so
 * "sabe" looks up "saber" exactly as the strip would.
 */

import { useEffect, useMemo, useState } from 'react';

import type { Lang, ResolvedWord, Token } from './types';
import { normalize } from './tokenize';
import { toLookupForm } from './lexicon';
import { resolveAll } from './resolve';

/** The token a card resolves with. Exported for tests. */
export function cardToken(word: string, lang: Lang): Token {
  const normalized = normalize(word);
  return { raw: word, normalized, lookup: toLookupForm(normalized, lang) };
}

export interface UseWordCardsResult {
  /** Same order and length as the words given. Empty until resolved. */
  cards: ResolvedWord[];
  isResolving: boolean;
}

/**
 * @param revision  anything that changes when an adult correction does, so a
 *                  pin made from the fix dialog shows on the card at once
 */
export function useWordCards(words: readonly string[], lang: Lang, revision?: unknown): UseWordCardsResult {
  const [cards, setCards] = useState<ResolvedWord[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  // Keyed on the words themselves: callers rebuild the array on every render.
  const key = words.join('|');
  const tokens = useMemo(
    () => (key ? key.split('|').map((word) => cardToken(word, lang)) : []),
    [key, lang],
  );

  useEffect(() => {
    if (tokens.length === 0) {
      setCards([]);
      setIsResolving(false);
      return undefined;
    }

    const controller = new AbortController();
    let current = true;
    setIsResolving(true);

    resolveAll(tokens, lang, controller.signal)
      .then((resolved) => {
        if (!current) return;
        setCards(resolved);
        setIsResolving(false);
      })
      .catch(() => {
        // resolveAll does not throw for misses. An abort or a surprise: never
        // leave the card stuck loading.
        if (current) setIsResolving(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [tokens, lang, revision]);

  return { cards, isResolving };
}
