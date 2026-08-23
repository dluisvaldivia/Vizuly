/**
 * The speech seam.
 *
 * One implementation today (Deepgram, browser-side). This interface is the
 * designated v2 swap point for the server-proxied client, which is what finally
 * gets the API key out of the public bundle.
 *
 * Nothing here mentions Deepgram. If it did, the seam would not be a seam.
 */

import type { Lang } from '../aac/types';

/**
 * What the microphone is doing, as far as the child is concerned.
 *
 * 'listening' is the only state that shows an active indicator. 'error' exists
 * so an adult can diagnose, and is never presented to the child as a failure:
 * there are no failure states in this app.
 */
export type SpeechStatus = 'idle' | 'connecting' | 'listening' | 'error';

export interface SpeechCallbacks {
  /**
   * A finished utterance. Only called for final transcripts, never interim
   * ones: the strip should not flicker through half-heard guesses while the
   * child is still talking.
   */
  onFinal: (transcript: string) => void;
  /**
   * The in-progress transcript, for the listening indicator only. Optional
   * because a source may not produce them.
   */
  onInterim?: (transcript: string) => void;
  onStatus: (status: SpeechStatus) => void;
  /** Diagnostic. Adult-facing, never shown to the child. */
  onError?: (message: string) => void;
}

/**
 * A source of spoken words.
 *
 * `start` must be safe to call when already started, and `stop` safe when
 * already stopped. Implementations own their own teardown.
 */
export interface SpeechSource {
  start: (lang: Lang, callbacks: SpeechCallbacks) => Promise<void>;
  stop: () => void;
  /** True when the environment can support this source at all. */
  isAvailable: () => boolean;
}
