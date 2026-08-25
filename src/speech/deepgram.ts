/**
 * Deepgram live speech, browser-side.
 *
 * Built against @deepgram/sdk v5, whose surface is
 * `client.listen.v1.connect(args)` returning a `V1Socket`. Verified against the
 * bundled type definitions, not from memory: v5 has no `createClient` and no
 * `.live()`, which earlier major versions did.
 *
 * Browsers cannot set an Authorization header on a WebSocket. The SDK handles
 * that for us via the connect args, which is the reason this dependency exists
 * at all rather than a raw WebSocket. See src/speech/CLAUDE.md.
 */

import { DeepgramClient } from '@deepgram/sdk';

import type { Lang } from '../aac/types';
import { LANG_CODES } from '../aac/types';
import type { SpeechCallbacks, SpeechSource } from './types';

/**
 * nova-2 supports both Spanish and English and is the safe choice for a child
 * with atypical articulation. Kept in one place so it is easy to trial nova-3.
 */
const MODEL = 'nova-2';

/** Mic capture format. linear16 at 16 kHz mono is what Deepgram expects. */
const SAMPLE_RATE = 16000;

/** How often to hand audio to the socket. Small enough to feel immediate. */
const CHUNK_MS = 250;

/** Deepgram closes an idle socket. Ping well inside that window. */
const KEEPALIVE_MS = 8000;

/**
 * How long to wait after CloseStream for the final transcript before closing
 * the socket. Long enough for the flush, short enough that the mic light does
 * not linger after the child presses stop.
 */
const FLUSH_GRACE_MS = 1500;

interface DeepgramTranscriptMessage {
  channel?: { alternatives?: { transcript?: string }[] };
  is_final?: boolean;
  speech_final?: boolean;
}

export function createDeepgramSource(apiKey: string): SpeechSource {
  let socket: Awaited<ReturnType<DeepgramClient['listen']['v1']['connect']>> | null = null;
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  /**
   * Held at this scope, unlike the other callbacks, because teardown() must be
   * able to zero the level and teardown() is called from paths that have no
   * callbacks object in hand.
   */
  let onLevel: ((level: number) => void) | undefined;

  /** True when not capturing. Gates audio capture and status updates. */
  let stopped = true;

  /**
   * True once the child's session is genuinely over, as opposed to merely
   * stopped and waiting for the final flush.
   *
   * These are deliberately separate: stop() must halt the microphone at once,
   * but the CloseStream flush still needs to deliver the last thing he said.
   * Gating transcripts on `stopped` alone would throw that away.
   */
  let abandoned = true;

  function teardown(): void {
    if (keepAlive !== null) {
      clearInterval(keepAlive);
      keepAlive = null;
    }

    processor?.disconnect();
    processor = null;

    // Settle the waveform. Without this the last loud frame stays on screen and
    // the button looks like it is still hearing something after stop.
    onLevel?.(0);

    // Release the microphone. Without this the browser keeps showing the
    // recording indicator, which would confuse both the child and the adult.
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;

    void audioContext?.close().catch(() => {});
    audioContext = null;

    const closing = socket;
    socket = null;

    if (closing === null) return;

    try {
      // Flush whatever the child said last. Without CloseStream, Deepgram holds
      // the trailing utterance and never emits its final transcript, so the last
      // thing he said before pressing stop is silently lost. Verified against
      // the live API.
      closing.sendCloseStream({ type: 'CloseStream' });

      // Give Deepgram a moment to return that final transcript before tearing
      // the socket down. Closing immediately would defeat the flush above.
      setTimeout(() => {
        abandoned = true;
        try {
          closing.close();
        } catch {
          // Already closed by the server after CloseStream. Expected.
        }
      }, FLUSH_GRACE_MS);
    } catch {
      // Socket already gone, so there is nothing to flush and no reason to wait.
      abandoned = true;
      try {
        closing.close();
      } catch {
        // Nothing left to do.
      }
    }
  }

  async function start(lang: Lang, callbacks: SpeechCallbacks): Promise<void> {
    // Safe to call when already running.
    if (!stopped) return;
    stopped = false;
    abandoned = false;
    onLevel = callbacks.onLevel;

    callbacks.onStatus('connecting');

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // The adult denied the mic, or there is no mic. Not a child-facing error.
      if (stopped) {
        teardown();
        return;
      }

      const client = new DeepgramClient({ apiKey });

      socket = await client.listen.v1.connect({
        Authorization: `Token ${apiKey}`,
        model: MODEL,
        language: LANG_CODES[lang].deepgram,
        encoding: 'linear16',
        sample_rate: SAMPLE_RATE,
        channels: 1,
        // These become query-string values, so the SDK types them as strings
        // rather than booleans. Verified against the bundled .d.ts files.
        interim_results: 'true',
        smart_format: 'true',
        punctuate: 'true',
        // Deepgram decides when an utterance ended, rather than us guessing from
        // silence. A child pauses mid-sentence more than an adult does.
        endpointing: 800,
        utterance_end_ms: 1500,
      });

      socket.on('open', () => {
        if (stopped) return;
        callbacks.onStatus('listening');
      });

      socket.on('message', (message) => {
        // Gated on `abandoned`, not `stopped`, so the final transcript flushed
        // by CloseStream still reaches the child after he presses stop.
        if (abandoned) return;

        const data = message as DeepgramTranscriptMessage;
        const transcript = data.channel?.alternatives?.[0]?.transcript?.trim();

        if (!transcript) return;

        if (data.is_final || data.speech_final) {
          callbacks.onFinal(transcript);
        } else if (!stopped) {
          // Interim results are only useful while actually listening.
          callbacks.onInterim?.(transcript);
        }
      });

      socket.on('error', (error: Error) => {
        if (stopped) return;
        callbacks.onStatus('error');
        callbacks.onError?.(error.message);
      });

      socket.on('close', () => {
        if (stopped) return;
        callbacks.onStatus('idle');
      });

      // The socket returned by connect() is NOT open: it comes back in
      // readyState 3 (CLOSED). Handlers must be registered first, then
      // socket.connect() opens it. Verified against the live API, because
      // omitting this fails silently: no error, no open event, and a mic button
      // that looks like it is working while nothing is transmitted.
      socket.connect();

      startCapture(callbacks);

      keepAlive = setInterval(() => {
        try {
          socket?.sendKeepAlive({ type: 'KeepAlive' });
        } catch {
          // Socket already gone. The close handler covers the state change.
        }
      }, KEEPALIVE_MS);
    } catch (error) {
      // A genuine failure: nothing to flush, so abandon outright.
      stopped = true;
      abandoned = true;
      teardown();
      callbacks.onStatus('error');
      callbacks.onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Pump microphone audio into the socket as linear16.
   *
   * ScriptProcessorNode is deprecated in favour of AudioWorklet, but it needs no
   * separate module file, which keeps the GitHub Pages build a single bundle. It
   * remains supported everywhere this app runs.
   */
  function startCapture(callbacks: SpeechCallbacks): void {
    if (!stream) return;

    const context = new AudioContext({ sampleRate: SAMPLE_RATE });
    audioContext = context;

    const source = context.createMediaStreamSource(stream);
    const bufferSize = nearestPowerOfTwo((SAMPLE_RATE * CHUNK_MS) / 1000);
    const node = context.createScriptProcessor(bufferSize, 1, 1);
    processor = node;

    node.onaudioprocess = (event) => {
      if (stopped || !socket) return;

      const input = event.inputBuffer.getChannelData(0);

      // Report loudness before anything that can throw, so the child keeps
      // seeing the waveform react even if the socket has gone away.
      callbacks.onLevel?.(peakLevel(input));

      try {
        socket.sendMedia(floatToPcm16(input));
      } catch (error) {
        callbacks.onError?.(error instanceof Error ? error.message : String(error));
      }
    };

    source.connect(node);
    // ScriptProcessorNode only fires while connected to a destination. The gain
    // is zero so the child never hears himself echoed back.
    const mute = context.createGain();
    mute.gain.value = 0;
    node.connect(mute);
    mute.connect(context.destination);
  }

  function stop(): void {
    if (stopped) return;

    // Halt the microphone immediately, but stay non-abandoned so the flushed
    // final transcript still lands. `abandoned` flips once the grace window
    // closes, inside teardown().
    stopped = true;
    teardown();
  }

  function isAvailable(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      apiKey.length > 0
    );
  }

  return { start, stop, isAvailable };
}

/**
 * Loudest sample in the frame, 0 to 1.
 *
 * Peak rather than RMS on purpose: RMS averages a short excited noise down to
 * almost nothing, and a child who shouts one syllable should see the waveform
 * jump. Peak over-reports steady background noise, which the visualiser's own
 * floor handles.
 */
function peakLevel(input: Float32Array): number {
  let peak = 0;

  for (let i = 0; i < input.length; i += 1) {
    const magnitude = Math.abs(input[i]);
    if (magnitude > peak) peak = magnitude;
  }

  return peak > 1 ? 1 : peak;
}

/** Float32 [-1,1] to signed 16-bit PCM, which is what linear16 means. */
function floatToPcm16(input: Float32Array): ArrayBuffer {
  const output = new Int16Array(input.length);

  for (let i = 0; i < input.length; i += 1) {
    // Clamp before scaling, or a value slightly outside the range wraps around
    // and becomes loud noise at the opposite polarity.
    const clamped = Math.max(-1, Math.min(1, input[i]));
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  return output.buffer;
}

/** ScriptProcessorNode requires a power-of-two buffer size between 256 and 16384. */
function nearestPowerOfTwo(value: number): number {
  const clamped = Math.max(256, Math.min(16384, value));
  return 2 ** Math.round(Math.log2(clamped));
}
