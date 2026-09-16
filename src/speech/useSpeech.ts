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

// Re-exported so the meter can draw the same scale the recogniser measures on,
// without the UI reaching past this seam into the Deepgram implementation.
export { DEFAULT_SPEECH_FLOOR_DB, toDbfs } from './deepgram';

export interface Microphone {
  deviceId: string;
  label: string;
}

/**
 * The microphones this browser can see, for the adult's picker.
 *
 * Labels are empty until the page has been granted the microphone once, which
 * the caller shows as "use the mic first". Never throws.
 */
export async function listMicrophones(): Promise<Microphone[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default')
      .map((device) => ({ deviceId: device.deviceId, label: device.label }));
  } catch {
    return [];
  }
}

export interface UseSpeechResult {
  status: SpeechStatus;
  /** True only while actually listening. Drives the indicator and the meter. */
  isListening: boolean;
  /**
   * True while listening OR connecting: what pressing the button would stop.
   *
   * Separate from `isListening` because the two answer different questions. The
   * meter and the wave should only move when audio is really flowing; the
   * button's label and pressed state must follow what a press would do.
   */
  isActive: boolean;
  /** In-progress transcript, for the indicator. Empty when not listening. */
  interim: string;
  /** Adult-facing diagnostic. Never shown to the child. */
  error: string | null;
  /** True when speech can work at all: mic API present and a key configured. */
  isAvailable: boolean;
  /**
   * Live microphone loudness, 0 to 1, as a ref rather than state.
   *
   * Deliberately not state: this updates several times a second while the child
   * is talking, and putting it through setState would re-render the whole app
   * (pictogram strip included) on every audio frame. The visualiser reads it
   * from its own animation frame instead.
   */
  levelRef: { current: number };
  /**
   * Microphone loudness right now, 0 to 1, or 0 when not listening.
   *
   * Polled once per animation frame by the level meter. `levelRef` is fed by the
   * source pushing whenever it hands audio on, which is too coarse to animate
   * smoothly; this reads the microphone at the moment it is asked.
   */
  getLevel: () => number;
  toggle: () => void;
  stop: () => void;
}

/**
 * Microphone input.
 *
 * `onFinal` fires once per finished utterance. The caller decides what to do
 * with it, which keeps this hook ignorant of pictograms entirely.
 */
export function useSpeech(
  lang: Lang,
  onFinal: (transcript: string) => void,
  options?: {
    speechFloorDb?: number;
    /** The microphone to ask for. Empty or omitted means the system default. */
    deviceId?: string;
    /** Its name, used when the id has gone stale. */
    deviceLabel?: string;
    /** Let the browser adjust the mic volume by itself. */
    autoGainControl?: boolean;
    /** The microphone the browser really opened, for display only. */
    onDeviceChange?: (deviceId: string, label: string) => void;
  },
): UseSpeechResult {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sourceRef = useRef<SpeechSource | null>(null);
  const levelRef = useRef(0);

  /**
   * Everything he has said since the mic was turned on, joined back together.
   *
   * Deepgram finalises a slow talker one word at a time: "hola... me... llamo...
   * Noah" arrives as four separate final transcripts. `onFinal` is handed the
   * whole phrase each time, not the latest fragment, so the strip grows as he
   * speaks instead of being overwritten down to the last word. Cleared when the
   * mic is turned on, not when it is turned off: stopping flushes one last
   * fragment that still needs to join the phrase he already built.
   */
  const phraseRef = useRef('');

  // Held in a ref so changing the callback does not tear down a live socket
  // mid-sentence.
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  // Same reasoning: an adult moving the sensitivity slider must not be able to
  // close a socket the child is mid-sentence on. Read at start(), so a change
  // applies from the next time the mic is opened.
  const floorRef = useRef(options?.speechFloorDb);
  useEffect(() => {
    floorRef.current = options?.speechFloorDb;
  }, [options?.speechFloorDb]);

  // Read at start() for the same reason as the floor.
  const deviceRef = useRef({ id: options?.deviceId, label: options?.deviceLabel });
  useEffect(() => {
    deviceRef.current = { id: options?.deviceId, label: options?.deviceLabel };
  }, [options?.deviceId, options?.deviceLabel]);

  // Read at start() for the same reason as the floor.
  const gainRef = useRef(options?.autoGainControl);
  useEffect(() => {
    gainRef.current = options?.autoGainControl;
  }, [options?.autoGainControl]);

  const onDeviceRef = useRef(options?.onDeviceChange);
  useEffect(() => {
    onDeviceRef.current = options?.onDeviceChange;
  }, [options?.onDeviceChange]);

  if (sourceRef.current === null) {
    const key = import.meta.env.VITE_DEEPGRAM_API_KEY ?? '';
    sourceRef.current = createDeepgramSource(key);
  }

  const isAvailable = sourceRef.current?.isAvailable() ?? false;

  // Stable, so the meter's animation loop is never torn down and restarted by a
  // re-render. Reads through the ref rather than closing over the source.
  const getLevel = useCallback(() => sourceRef.current?.getLevel?.() ?? 0, []);

  const stop = useCallback(() => {
    sourceRef.current?.stop();
    setStatus('idle');
    setInterim('');
    levelRef.current = 0;
    // phraseRef is deliberately not cleared here. Stopping still triggers a
    // CloseStream flush, and that final fragment must append to the phrase he
    // already built, not replace it. The next mic-on clears it.
  }, []);

  // Always release the microphone when the component goes away.
  useEffect(() => {
    return () => sourceRef.current?.stop();
  }, []);

  /**
   * On, in the sense the button means it: pressing now stops.
   *
   * Includes 'connecting', unlike `isListening`, which is about whether audio is
   * genuinely flowing. The button reads from this one so it can never say "Talk"
   * while pressing it would in fact stop.
   */
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
    levelRef.current = 0;
  }, [lang]);

  const toggle = useCallback(() => {
    // This read of React state is advisory, not load-bearing. If it ever
    // disagrees with the source, neither branch dead-ends: stop() is a no-op
    // when already stopped, and start() closes any stale session before opening
    // a fresh one. That is the half of the dead-button fix that lives up here.
    if (listening) {
      stop();
      return;
    }

    setError(null);
    setInterim('');
    levelRef.current = 0;
    phraseRef.current = '';

    void sourceRef.current?.start(lang, {
      onFinal: (transcript) => {
        setInterim('');
        // Append this fragment to the running phrase and resolve the whole
        // thing. A slow talker is finalised a word at a time, and the strip
        // should build up, not jump to the last word.
        phraseRef.current = `${phraseRef.current} ${transcript}`.trim();
        onFinalRef.current(phraseRef.current);
      },
      onInterim: setInterim,
      // Straight into the ref. No setState: see levelRef above.
      onLevel: (level) => {
        levelRef.current = level;
      },
      onStatus: (next) => {
        setStatus(next);
        // 'idle' can now arrive without a button press, when the mic auto-stops
        // after the child goes quiet. Clear the indicator the same way the
        // manual stop() does, so the interim line and level do not linger.
        // 'error' now also means the source has torn itself down, so it has to
        // clear the indicator exactly like 'idle' does. Without this a stale
        // interim line and a frozen level survive a dropped connection.
        if (next === 'idle' || next === 'error') {
          setInterim('');
          levelRef.current = 0;
        }
      },
      onDevice: (deviceId, label) => onDeviceRef.current?.(deviceId, label),
      onError: setError,
    }, { speechFloorDb: floorRef.current, deviceId: deviceRef.current.id || undefined,
      deviceLabel: deviceRef.current.label || undefined,
      autoGainControl: gainRef.current,
    });
  }, [lang, listening, stop]);

  return {
    status,
    isListening: status === 'listening',
    interim,
    error,
    isAvailable,
    isActive: listening,
    levelRef,
    getLevel,
    toggle,
    stop,
  };
}
