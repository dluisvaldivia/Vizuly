/**
 * The only module the UI imports from the engine.
 *
 * Not resolve, not arasaac, not tokenize. One seam, one import. Everything
 * below this line is plain functions with no React; everything above it is UI.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Lang, ResolvedWord } from './types';
import { tokenize } from './tokenize';
import { resolveAll } from './resolve';
import { clearCache, pinCorrection } from './cache';

export type { Lang, ResolvedWord } from './types';
export { pictogramImageUrl } from './arasaac';

export interface UseAacResult {
  /** The pictogram sequence, in order. Empty until something is submitted. */
  words: ResolvedWord[];
  /** True while resolving. Drives the busy indicator, never a failure state. */
  isResolving: boolean;
  /** The text that produced the current strip, for the adult to see. */
  phrase: string;
  /** Resolve a phrase and replace the strip. */
  say: (input: string) => void;
  /** Empty the strip. */
  clear: () => void;
  /** Pin a correction for a word, permanently. Adult action. */
  correct: (lookup: string, pictogramId: number) => void;
  /** Forget every cached pictogram. Adult action. */
  forgetAll: () => void;
}

/**
 * Turn text into a pictogram sequence.
 *
 * Language is passed in rather than owned here, so the caller controls
 * persistence and the hook stays a pure transform.
 */
export function useAac(lang: Lang): UseAacResult {
  const [words, setWords] = useState<ResolvedWord[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const [phrase, setPhrase] = useState('');

  /**
   * Guards against a slow earlier request overwriting a newer strip. The child
   * may say something new before the previous lookup finishes, and the last
   * thing he said is always the thing to show.
   */
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request when the component goes away.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const say = useCallback(
    (input: string) => {
      const tokens = tokenize(input, lang);
      setPhrase(input);

      // Nothing to show. Not an error, just an empty strip.
      if (tokens.length === 0) {
        abortRef.current?.abort();
        requestRef.current += 1;
        setWords([]);
        setIsResolving(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const requestId = requestRef.current + 1;
      requestRef.current = requestId;

      setIsResolving(true);

      resolveAll(tokens, lang, controller.signal)
        .then((resolved) => {
          // A newer phrase arrived while this was in flight. Discard.
          if (requestRef.current !== requestId) return;
          setWords(resolved);
          setIsResolving(false);
        })
        .catch(() => {
          // resolveAll does not throw for misses, so this is an abort or a
          // genuine surprise. Either way, do not leave the spinner stuck.
          if (requestRef.current !== requestId) return;
          setIsResolving(false);
        });
    },
    [lang],
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    requestRef.current += 1;
    setWords([]);
    setPhrase('');
    setIsResolving(false);
  }, []);

  const correct = useCallback(
    (lookup: string, pictogramId: number) => {
      pinCorrection(lookup, lang, pictogramId);
      // Reflect the fix immediately, without a re-resolve.
      setWords((current) =>
        current.map((word) =>
          word.token.lookup === lookup
            ? { ...word, pictogramId, source: 'override' as const }
            : word,
        ),
      );
    },
    [lang],
  );

  const forgetAll = useCallback(() => {
    clearCache();
  }, []);

  return { words, isResolving, phrase, say, clear, correct, forgetAll };
}
