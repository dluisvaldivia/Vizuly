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
  /**
   * Microphone loudness, 0 to 1, emitted continuously while capturing.
   *
   * Exists so the child can see the app reacting to their voice in real time,
   * rather than waiting for a transcript. Deliberately a raw level and not a
   * word: it responds to any sound the child makes, including ones Deepgram will
   * never turn into text. Optional because a source may not produce audio
   * levels at all.
   */
  onLevel?: (level: number) => void;
  onStatus: (status: SpeechStatus) => void;
  /**
   * The microphone the browser actually opened, once per session.
   *
   * For the adult panel, so it is visible which mic is really in use. The source
   * never stores this. The caller may refresh a saved id from it, but only when
   * the name matches the adult's choice: remembering whatever the browser happened
   * to open would lock in a silent default.
   */
  onDevice?: (deviceId: string, label: string) => void;
  /** Diagnostic. Adult-facing, never shown to the child. */
  onError?: (message: string) => void;
}

/** Per-session tuning handed to `start`. */
export interface SpeechStartOptions {
  /**
   * Level at which the child's voice counts as speech, in dBFS.
   *
   * Set by the adult in settings and passed down per session. The source keeps
   * its own voice-activity floor a fixed margin below this, so the microphone
   * can never decide the child has stopped talking while the meter still says they are
   * loud enough.
   */
  speechFloorDb?: number;
  /**
   * The microphone to open. Requested as `exact`, because browsers may treat
   * `ideal` as a hint. If it has been unplugged, the default opens instead.
   */
  deviceId?: string;
  /**
   * That microphone's name. Device ids can change between reloads, so a stale id
   * is recovered by finding the mic with this name.
   */
  deviceLabel?: string;
  /**
   * Whether the browser may raise and lower the mic volume by itself. Off keeps
   * the level steady, so the meter and the speech floor mean the same thing on
   * the first syllable as on the last. Omitted means off.
   */
  autoGainControl?: boolean;
}

/**
 * A source of spoken words.
 *
 * `start` must be safe to call when already started, and `stop` safe when
 * already stopped. Implementations own their own teardown.
 */
export interface SpeechSource {
  start: (
    lang: Lang,
    callbacks: SpeechCallbacks,
    options?: SpeechStartOptions,
  ) => Promise<void>;
  stop: () => void;
  /** True when the environment can support this source at all. */
  isAvailable: () => boolean;
  /**
   * Microphone loudness right now, 0 to 1, or 0 when not capturing.
   *
   * Pull, where `onLevel` is push, and it exists because the two answer
   * different questions. `onLevel` fires whenever the implementation happens to
   * hand audio on, which is far too coarse to draw a smooth meter from. This can
   * be polled once per animation frame for a bar that tracks the voice fluidly.
   *
   * Optional: a source that cannot measure loudness simply omits it.
   */
  getLevel?: () => number;
}
