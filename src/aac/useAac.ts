/**
 * The only module the UI imports from the engine.
 *
 * Not resolve, not arasaac, not tokenize. One seam, one import. Everything
 * below this line is plain functions with no React; everything above it is UI.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Lang, ResolvedWord } from './types';
import type { Correction, CorrectionEntry } from './corrections';
import { tokenize } from './tokenize';
import { resolveAll } from './resolve';
import { clearCache } from './cache';
import {
  listCorrections,
  readCorrection,
  removeCorrection,
  setCorrection,
} from './corrections';

export type { Lang, ResolvedWord } from './types';
export type { Correction, CorrectionEntry } from './corrections';
export { pictogramImageUrl, searchCandidates } from './arasaac';
export { exportCorrections } from './corrections';

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
  /**
   * Pin the right pictogram for a word, permanently. Adult action.
   *
   * Keyed on the LOOKUP form, because that is what resolve() is given. A pin on
   * "llamar" fixes every conjugation the lemma map rewrites to it.
   */
  correct: (lookup: string, pictogramId: number) => void;
  /**
   * Drop a word before resolution, like a stopword. Adult action.
   *
   * Keyed on the NORMALIZED form, because tokenize decides this before the
   * lemma map runs. Protected core vocabulary ignores this, by design.
   */
  ignoreWord: (normalized: string) => void;
  /** Mark a word as wrong without fixing it. Changes nothing the child sees. */
  flagWord: (normalized: string) => void;
  /** Undo any correction for a word. Every adult action is reversible. */
  undoCorrection: (word: string) => void;
  /** What an adult already decided about this word, or null. */
  correctionFor: (word: string) => Correction | null;
  /** Every correction, for the adult review list. Both languages. */
  corrections: CorrectionEntry[];
  /** Forget every cached pictogram. Adult action. Corrections survive it. */
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
  const [corrections, setCorrections] = useState<CorrectionEntry[]>(listCorrections);

  /**
   * Guards against a slow earlier request overwriting a newer strip. The child
   * may say something new before the previous lookup finishes, and the last
   * thing he said is always the thing to show.
   */
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  /** Current language, read by the correction callbacks. Kept off their deps. */
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

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

  /**
   * The current phrase, for re-running it after a correction.
   *
   * A ref rather than a dependency so the correction callbacks do not change
   * identity on every keystroke of the adult's typing.
   */
  const phraseRef = useRef('');
  useEffect(() => {
    phraseRef.current = phrase;
  }, [phrase]);

  const sayRef = useRef(say);
  useEffect(() => {
    sayRef.current = say;
  }, [say]);

  /**
   * Write a decision and show its effect at once.
   *
   * Re-running the phrase rather than patching the strip in place is deliberate:
   * an ignore removes a word entirely, and a pin has to beat a cache entry, so
   * only a real re-resolve produces what the child will actually see next time.
   * It costs nothing: every word is already cached or corrected, so this does
   * not touch the network.
   */
  const applyCorrection = useCallback((word: string, correction: Correction | null) => {
    if (correction) {
      setCorrection(word, langRef.current, correction);
    } else {
      removeCorrection(word, langRef.current);
    }

    setCorrections(listCorrections());
    if (phraseRef.current) sayRef.current(phraseRef.current);
  }, []);

  const correct = useCallback(
    (lookup: string, pictogramId: number) => applyCorrection(lookup, { kind: 'pin', pictogramId }),
    [applyCorrection],
  );

  const ignoreWord = useCallback(
    (normalized: string) => applyCorrection(normalized, { kind: 'ignore' }),
    [applyCorrection],
  );

  const flagWord = useCallback(
    (normalized: string) => applyCorrection(normalized, { kind: 'flag' }),
    [applyCorrection],
  );

  const undoCorrection = useCallback(
    (word: string) => applyCorrection(word, null),
    [applyCorrection],
  );

  const correctionFor = useCallback((word: string) => readCorrection(word, lang), [lang]);

  const forgetAll = useCallback(() => {
    clearCache();
    // Corrections are not cache entries and survive on purpose, so the strip
    // still shows every pinned symbol after this.
    if (phraseRef.current) sayRef.current(phraseRef.current);
  }, []);

  return {
    words,
    isResolving,
    phrase,
    say,
    clear,
    correct,
    ignoreWord,
    flagWord,
    undoCorrection,
    correctionFor,
    corrections,
    forgetAll,
  };
}
