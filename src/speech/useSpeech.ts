/**
 * The only module the UI imports from the speech layer.
 *
 * Mirrors the useAac seam: one import, no implementation details leaking out.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Lang } from '../aac/types';
import type { SpeechSource, SpeechStatus } from './types';
import { createDeepgramSource } from './deepgram';

export type { SpeechStatus } from './types';

export interface UseSpeechResult {
  status: SpeechStatus;
  /** True only while actually listening. Drives the indicator. */
  isListening: boolean;
  /** In-progress transcript, for the indicator. Empty when not listening. */
  interim: string;
  /** Adult-facing diagnostic. Never shown to the child. */
  error: string | null;
  /** True when speech can work at all: mic API present and a key configured. */
  isAvailable: boolean;
  toggle: () => void;
  stop: () => void;
}

/**
 * Microphone input.
 *
 * `onFinal` fires once per finished utterance. The caller decides what to do
 * with it, which keeps this hook ignorant of pictograms entirely.
 */
export function useSpeech(lang: Lang, onFinal: (transcript: string) => void): UseSpeechResult {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sourceRef = useRef<SpeechSource | null>(null);

  // Held in a ref so changing the callback does not tear down a live socket
  // mid-sentence.
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  if (sourceRef.current === null) {
    const key = import.meta.env.VITE_DEEPGRAM_API_KEY ?? '';
    sourceRef.current = createDeepgramSource(key);
  }

  const isAvailable = sourceRef.current?.isAvailable() ?? false;

  const stop = useCallback(() => {
    sourceRef.current?.stop();
    setStatus('idle');
    setInterim('');
  }, []);

  // Always release the microphone when the component goes away.
  useEffect(() => {
    return () => sourceRef.current?.stop();
  }, []);

  const listening = status === 'listening' || status === 'connecting';

  // Close the microphone when the language changes.
  //
  // Deliberately does not restart: an adult changed the language, so an adult
  // can press the button again. Silently reopening the mic after a settings
  // change would be surprising, and the child should never find the app
  // listening without someone having asked it to.
  //
  // Depends on `lang` alone by design. Reading `listening` here would reopen
  // this effect on every status transition and close the socket mid-sentence,
  // so the stop call is made unconditionally instead: it is a no-op when the
  // source is already stopped.
  useEffect(() => {
    sourceRef.current?.stop();
    setStatus('idle');
    setInterim('');
  }, [lang]);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
      return;
    }

    setError(null);
    setInterim('');

    void sourceRef.current?.start(lang, {
      onFinal: (transcript) => {
        setInterim('');
        onFinalRef.current(transcript);
      },
      onInterim: setInterim,
      onStatus: setStatus,
      onError: setError,
    });
  }, [lang, listening, stop]);

  return {
    status,
    isListening: status === 'listening',
    interim,
    error,
    isAvailable,
    toggle,
    stop,
  };
}
