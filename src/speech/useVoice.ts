/**
 * The only module the UI imports for spoken output.
 *
 * Mirrors the useSpeech and useAac seams: one import, no implementation detail
 * leaking out. The UI asks it to say a word and it decides how, in this order:
 *
 *   1. a clip already on the device, generated earlier for a word off the list
 *   2. a pre-generated Aura-2 clip shipped with the app
 *   3. the browser's own voice, plus a note to the adult explaining why
 *
 * Step 3 never waits for step 1 or 2 to fail slowly. The child hears something
 * immediately, always, which is rule 4 applied to audio.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Lang, ResolvedWord } from '../aac/types';
import { speakWord } from './speakWord';
import { clipModeFor, fetchLiveClip, playClip, staticClipUrl, voiceModel } from './voiceClips';
import { clearClips, clipKey, getClip } from './clipStore';
import { canSpend, usedToday, DAILY_LIMIT } from './voiceBudget';

/**
 * Why the browser voice is being used instead of the recorded one.
 *
 * 'recording' is the ordinary first time a word is tapped: Deepgram takes one
 * to two seconds to answer, which is far too long to leave a child waiting, so
 * the plain voice speaks now and the recording is ready for the next tap.
 */
export type VoiceNoticeKind = 'recording' | 'no-clip' | 'budget';

export interface VoiceNotice {
  kind: VoiceNoticeKind;
  word: string;
}

export interface UseVoiceOptions {
  /** Say the syllables after the word. The adult's setting. */
  syllables: boolean;
  /** Allow generating new words with Deepgram. Off by default. */
  live: boolean;
  /** The words on screen, so their stored clips can be readied. */
  words: ResolvedWord[];
  /**
   * Words likely to be tapped soon, such as the rest of an open letter deck.
   *
   * Only what is already free is readied for these: a clip saved on this
   * device, or one shipped with the app. Never a live recording, which costs
   * budget and belongs to the word actually on screen. Nothing is fetched for
   * any deck that is not open.
   */
  prefetch?: ResolvedWord[];
}

export interface UseVoiceResult {
  speak: (word: ResolvedWord, hooks?: { onStart?: () => void; onEnd?: () => void }) => void;
  /** Adult-facing, transient. Null most of the time. */
  notice: VoiceNotice | null;
  /** For the adult panel. */
  budget: { used: number; limit: number };
  /**
   * Throws away the clips generated on this device.
   *
   * Wired to "forget saved pictograms", because an adult reads that as "forget
   * what you have saved". The clips that ship with the app are untouched: they
   * are part of it, not something it saved.
   */
  forgetClips: () => void;
}

/** How long the adult has to read the notice before it leaves on its own. */
const NOTICE_MS = 5000;

const NONE: ResolvedWord[] = [];

export function useVoice(lang: Lang, { syllables, live, words, prefetch = NONE }: UseVoiceOptions): UseVoiceResult {
  const [notice, setNotice] = useState<VoiceNotice | null>(null);
  const [used, setUsed] = useState(0);

  /**
   * Clips read out of IndexedDB, as object URLs.
   *
   * They live in memory because reading IndexedDB is asynchronous, and an await
   * before play() loses the user gesture on iOS. This is not a network preload:
   * these bytes are already on the device.
   */
  const memoryClips = useRef(new Map<string, string>());
  /** One notice per reason per word per session, so it informs without nagging. */
  const noticed = useRef(new Set<string>());
  /** Words already sent to Deepgram this session, successfully or not. */
  const attempted = useRef(new Set<string>());
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setUsed(usedToday()), []);

  const show = useCallback((kind: VoiceNoticeKind, word: string) => {
    const seen = `${kind}:${word}`;
    if (noticed.current.has(seen)) return;
    noticed.current.add(seen);

    setNotice({ kind, word });
    if (noticeTimer.current !== null) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) clearTimeout(noticeTimer.current);
    },
    [],
  );

  // Everything for the words on screen, readied before the child touches anything.
  //
  // Two jobs, in order: read what this device already has out of IndexedDB, and
  // record whatever is still missing. Recording here rather than on the tap is
  // what makes the first tap sound right: Deepgram needs one to two seconds,
  // and a strip sits on screen for longer than that before a child reaches it.
  //
  // The effect keys off the words themselves rather than the array, which is
  // rebuilt on every resolve.
  const wordKeys = useMemo(() => words.map((word) => word.token.normalized).join('|'), [words]);
  const prefetchKeys = useMemo(() => prefetch.map((word) => word.token.normalized).join('|'), [prefetch]);
  const wordsRef = useRef(wordKeys);
  wordsRef.current = wordKeys;
  const prefetchRef = useRef(prefetchKeys);
  prefetchRef.current = prefetchKeys;

  // The language is part of every in-memory key. The strip is not emptied on a
  // language switch, so without it "no" would replay its Spanish clip under
  // the English voice.
  const keyFor = useCallback((word: string, mode: string) => `${lang}.${word}.${mode}`, [lang]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const onScreen = wordsRef.current.split('|').filter(Boolean);
      const ahead = prefetchRef.current.split('|').filter(Boolean);
      const wanted = new Set<string>();

      // The words on screen first, then the deck behind them, one at a time,
      // so readying the deck never delays the card the child is looking at.
      const queue = [...onScreen.map((word) => ({ word, free: false })), ...ahead.map((word) => ({ word, free: true }))];
      for (const { word, free } of queue) {
        if (cancelled) return;

        const mode = clipModeFor(word, lang, syllables);
        const key = keyFor(word, mode);
        wanted.add(key);
        if (memoryClips.current.has(key)) continue;

        const stored = await getClip(clipKey(voiceModel, lang, word, mode));
        if (cancelled) return;
        if (stored) {
          memoryClips.current.set(key, URL.createObjectURL(stored));
          continue;
        }

        const shipped = staticClipUrl(word, lang, mode);
        if (shipped) {
          // On screen: nothing to do, the browser fetches the file at play
          // time and caches it. Ahead: fetch that one file now, so the first
          // tap on the card plays without a round trip. One file, this deck.
          if (!free) continue;
          const blob = await fetch(shipped).then((res) => (res.ok ? res.blob() : null)).catch(() => null);
          if (cancelled) return;
          if (blob) memoryClips.current.set(key, URL.createObjectURL(blob));
          continue;
        }

        // Only the words on screen may cost anything.
        if (free || !live || !canSpend()) continue;
        // One attempt per word per session. Without this, a failed recording
        // would be retried on every resolve and eat the day's budget.
        if (attempted.current.has(key)) continue;
        attempted.current.add(key);

        const fresh = await fetchLiveClip(word, lang, mode);
        setUsed(usedToday());
        if (cancelled) return;
        if (fresh) memoryClips.current.set(key, URL.createObjectURL(fresh));
      }

      // Release anything no longer on screen, or the object URLs pile up for as
      // long as the app is open.
      memoryClips.current.forEach((url, key) => {
        if (wanted.has(key)) return;
        URL.revokeObjectURL(url);
        memoryClips.current.delete(key);
      });
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [wordKeys, prefetchKeys, lang, syllables, live, keyFor]);

  const speak = useCallback(
    (word: ResolvedWord, hooks: { onStart?: () => void; onEnd?: () => void } = {}) => {
      const spoken = word.token.raw;
      const normalized = word.token.normalized;
      const mode = clipModeFor(normalized, lang, syllables);

      const browserVoice = () =>
        speakWord(spoken, normalized, lang, { ...hooks, syllables });

      const stored = memoryClips.current.get(keyFor(normalized, mode));
      if (stored) {
        playClip(stored, { ...hooks, onFail: browserVoice });
        return;
      }

      const url = staticClipUrl(normalized, lang, mode);
      if (url) {
        playClip(url, { ...hooks, onFail: browserVoice });
        return;
      }

      // No recorded clip. Speak now with the browser voice, and only then think
      // about recording one: Deepgram needs one to two seconds to answer, and
      // the child never waits for the network.
      browserVoice();

      if (!live) {
        show('no-clip', spoken);
        return;
      }
      if (!canSpend()) {
        show('budget', spoken);
        return;
      }

      // Usually the strip already started this, and the tap simply arrived
      // first. Only record here if nothing has tried yet this session.
      const key = keyFor(normalized, mode);
      show('recording', spoken);
      if (attempted.current.has(key)) return;
      attempted.current.add(key);

      void fetchLiveClip(normalized, lang, mode).then((blob) => {
        setUsed(usedToday());
        if (!blob) return;
        // Ready for the next tap, without another read from IndexedDB.
        memoryClips.current.set(key, URL.createObjectURL(blob));
      });
    },
    [lang, syllables, live, show, keyFor],
  );

  const forgetClips = useCallback(() => {
    memoryClips.current.forEach((url) => URL.revokeObjectURL(url));
    memoryClips.current = new Map();
    // Cleared too, so a word thrown away can be recorded again rather than
    // being skipped for the rest of the session.
    attempted.current = new Set();
    void clearClips();
  }, []);

  return { speak, notice, budget: { used, limit: DAILY_LIMIT }, forgetClips };
}
