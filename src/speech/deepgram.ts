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
import type {
  SpeechCallbacks,
  SpeechSource,
  SpeechStartOptions,
  SpeechStatus,
} from './types';

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

/**
 * Silence, once he has started talking, that ends the whole session on its own.
 *
 * He does not press stop: he says a word or a short sentence and waits for the
 * pictograms. Deepgram's endpointing below decides where one utterance ends;
 * this decides when the turn is over and the microphone should close itself.
 *
 * 2500 ms because he speaks a word at a time with long gaps ("hola... me...
 * llamo... Noah"), measured with him directly. A shorter window cuts him off
 * between words. Any pause shorter than this only resets the timer.
 */
const AUTO_STOP_SILENCE_MS = 2500;

/**
 * Loudness, everywhere in this file, is RMS expressed in dBFS.
 *
 * Peak amplitude was tried first and is wrong for this job. Speech has a high
 * crest factor, so a single loud sample in an otherwise quiet word pushes peak
 * up by 10 dB or more: a softly spoken "hello" that Deepgram never transcribes
 * still reads as loud. RMS measures the energy that is actually there, and dB
 * spreads the quiet end out instead of crushing it into the bottom of the range.
 *
 * `peakLevel` stays, unchanged, for `onLevel` and the wave inside the button:
 * that one WANTS to jump on a single shouted syllable.
 */

/**
 * Default level at which his voice counts as speech worth acting on.
 *
 * An informed starting point, not a measurement. The adult panel's sensitivity
 * setting overrides it, and the on-screen readout exists to replace it with his
 * real numbers. Room tone with noise suppression sits near -50 dBFS, soft speech
 * near -33, an ordinary speaking voice near -24.
 */
export const DEFAULT_SPEECH_FLOOR_DB = -30;

/**
 * How far below the speech floor the auto-stop's voice-activity floor sits.
 *
 * The two thresholds share one measurement on purpose. The meter turns green at
 * the speech floor; the mic only gives up this far below it. That ordering is
 * what makes it impossible for the mic to close itself while the meter is
 * telling him he is loud enough.
 */
const AUTO_STOP_MARGIN_DB = 10;

/** Quietest level worth reporting. Below this is silence as far as we care. */
const SILENCE_DB = -100;

/**
 * Window the meter tap measures over. 1024 samples at 16 kHz is 64 ms: long
 * enough for a steady RMS reading, short enough that the bar still follows him.
 */
const METER_FFT_SIZE = 1024;

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
   * A passive tap on the same microphone, read on demand by getLevel().
   *
   * Separate from the ScriptProcessor above because they are sampled at
   * completely different rates: the processor hands over a chunk every CHUNK_MS,
   * which is the right size to send to Deepgram and far too coarse to animate a
   * meter from. This can be read as often as the screen refreshes. It sends
   * nothing anywhere and costs nothing: it reads audio that is already flowing.
   */
  let meterTap: AnalyserNode | null = null;
  // Explicitly backed by an ArrayBuffer: getFloatTimeDomainData rejects the
  // SharedArrayBuffer case that the bare Float32Array type also allows.
  let meterSamples: Float32Array<ArrayBuffer> | null = null;

  /**
   * Pending auto-stop. Rearmed on every frame that carries his voice, so it
   * only fires after AUTO_STOP_SILENCE_MS of genuine silence. Null until he
   * has said something, and cleared by teardown().
   */
  let autoStopTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Held at this scope, unlike the other callbacks, because teardown() must be
   * able to zero the level, and the auto-stop must be able to move the UI back
   * to idle, from paths that have no callbacks object in hand.
   */
  let onLevel: ((level: number) => void) | undefined;
  let onStatus: ((status: SpeechStatus) => void) | undefined;

  /**
   * Which microphone session we are on. Bumped by every start().
   *
   * `stopped` and `abandoned` below are per-SOURCE, and three things outlive a
   * session and write to them: the flush timer, the socket handlers, and the
   * keepAlive interval. Without an identity to compare against, a handler
   * created in one session happily mutates the next one's state, which is how a
   * finished session used to be able to mark a live one abandoned and push the
   * UI back to idle underneath it. Everything that can fire late captures the
   * generation it belongs to and does nothing if it is no longer current.
   *
   * Bumped in start() only. A stop() deliberately does NOT bump it, because the
   * CloseStream flush still has to deliver the words he just said.
   */
  let generation = 0;

  /** Level at which his voice counts as speech, in dBFS. Set per session. */
  let speechFloorDb = DEFAULT_SPEECH_FLOOR_DB;

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

  function teardown(gen: number): void {
    // Last line of defence. Every caller has already checked, but one late
    // callback from a superseded session reaching here would release the
    // microphone belonging to the session that replaced it.
    if (gen !== generation) return;

    if (keepAlive !== null) {
      clearInterval(keepAlive);
      keepAlive = null;
    }

    if (autoStopTimer !== null) {
      clearTimeout(autoStopTimer);
      autoStopTimer = null;
    }

    processor?.disconnect();
    processor = null;

    meterTap?.disconnect();
    meterTap = null;
    meterSamples = null;

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

    if (closing === null) {
      // Torn down before a socket ever existed: stopped during the permission
      // prompt, or during connect(). Nothing to flush and nothing to wait for,
      // so close the delivery window now rather than leaving `abandoned` false
      // with no session behind it.
      abandoned = true;
      return;
    }

    try {
      // Flush whatever the child said last. Without CloseStream, Deepgram holds
      // the trailing utterance and never emits its final transcript, so the last
      // thing he said before pressing stop is silently lost. Verified against
      // the live API.
      closing.sendCloseStream({ type: 'CloseStream' });

      // Give Deepgram a moment to return that final transcript before tearing
      // the socket down. Closing immediately would defeat the flush above.
      setTimeout(() => {
        // Only abandon if this is still our session. A press inside the grace
        // window starts a new one, and marking THAT abandoned would silently
        // drop every transcript it ever produces while the mic looked fine.
        if (gen === generation) abandoned = true;

        // Closed regardless: the socket belongs to this session either way, and
        // leaving it open leaks it. Its handlers are generation-guarded, so the
        // close event it fires cannot touch a newer session.
        try {
          closing.close();
        } catch {
          // Already closed by the server after CloseStream. Expected.
        }
      }, FLUSH_GRACE_MS);
    } catch {
      // Socket already gone, so there is nothing to flush and no reason to wait.
      if (gen === generation) abandoned = true;
      try {
        closing.close();
      } catch {
        // Nothing left to do.
      }
    }
  }

  async function start(
    lang: Lang,
    callbacks: SpeechCallbacks,
    options?: SpeechStartOptions,
  ): Promise<void> {
    // The caller and this source disagree about whether we are running, which
    // means something ended a session without telling us. Trust the caller and
    // clear the decks rather than returning silently: a silent return here is
    // exactly what used to leave the button dead until a page reload.
    if (!stopped) stop();

    generation += 1;
    const gen = generation;

    stopped = false;
    abandoned = false;
    speechFloorDb = options?.speechFloorDb ?? DEFAULT_SPEECH_FLOOR_DB;
    onLevel = callbacks.onLevel;
    onStatus = callbacks.onStatus;

    callbacks.onStatus('connecting');

    try {
      const media = await openMicrophone(
        options?.deviceId,
        options?.deviceLabel,
        options?.autoGainControl ?? false,
        () => !stopped && gen === generation,
      );

      // Resume point one. The permission prompt can sit open a long time, and a
      // tap on a pictogram calls stop() while it does. Held in a local until
      // after the check: releasing it through teardown() on a mismatch would be
      // releasing whatever the CURRENT session owns, not this one.
      if (stopped || gen !== generation) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }

      stream = media;

      // Which mic this really is. The caller shows it, and refreshes a stale
      // saved id when the name matches the adult's choice.
      const settings = media.getAudioTracks()[0]?.getSettings?.();
      if (settings?.deviceId) {
        callbacks.onDevice?.(settings.deviceId, media.getAudioTracks()[0]?.label ?? '');
      }

      const client = new DeepgramClient({ apiKey });

      const ws = await client.listen.v1.connect({
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

      // Resume point two, and the reason the socket is held in a local until
      // here. Publishing it first and bailing afterwards is not equivalent: on a
      // generation mismatch that would clobber the newer session's socket and
      // then destroy it.
      if (stopped || gen !== generation) {
        try {
          ws.close();
        } catch {
          // Never opened: connect() returns it CLOSED. Expected.
        }
        return;
      }

      socket = ws;

      ws.on('open', () => {
        if (gen !== generation || stopped) return;
        callbacks.onStatus('listening');
      });

      ws.on('message', (message) => {
        // Gated on `abandoned`, not `stopped`, so the final transcript flushed
        // by CloseStream still reaches the child after he presses stop. Gated on
        // the generation as well, so a transcript flushed by a session he has
        // already moved on from is dropped rather than glued onto the front of
        // the phrase he is building now.
        if (gen !== generation || abandoned) return;

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

      // Both of these end the session properly rather than only reporting it.
      // Reporting alone was the bug behind a mic button that stopped responding:
      // Deepgram closing the socket on its own left `stopped` false while the UI
      // showed idle, so the next press took the start branch, found the source
      // already running, and did nothing at all. Every press after that too.
      ws.on('error', (error: Error) => {
        if (gen !== generation || stopped) return;
        stopped = true;
        teardown(gen);
        callbacks.onStatus('error');
        callbacks.onError?.(error.message);
      });

      ws.on('close', () => {
        if (gen !== generation || stopped) return;
        stopped = true;
        teardown(gen);
        callbacks.onStatus('idle');
      });

      // The socket returned by connect() is NOT open: it comes back in
      // readyState 3 (CLOSED). Handlers must be registered first, then
      // socket.connect() opens it. Verified against the live API, because
      // omitting this fails silently: no error, no open event, and a mic button
      // that looks like it is working while nothing is transmitted.
      ws.connect();

      startCapture(callbacks, gen);

      // Held in a local as well as the shared slot so it can clear itself. A
      // ping fired after this session ended would be keeping a dead stream
      // alive, or worse, pinging on the newer session's socket.
      const ping = setInterval(() => {
        if (gen !== generation) {
          clearInterval(ping);
          return;
        }

        try {
          socket?.sendKeepAlive({ type: 'KeepAlive' });
        } catch {
          // Socket already gone. The close handler covers the state change.
        }
      }, KEEPALIVE_MS);

      keepAlive = ping;
    } catch (error) {
      // A genuine failure: nothing to flush, so abandon outright. Silent if a
      // newer session has already taken over, because this one's failure is no
      // longer anything the child needs to know about.
      if (gen !== generation) return;

      stopped = true;
      abandoned = true;
      teardown(gen);
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
  function startCapture(callbacks: SpeechCallbacks, gen: number): void {
    if (!stream) return;

    const context = new AudioContext({ sampleRate: SAMPLE_RATE });
    audioContext = context;

    const source = context.createMediaStreamSource(stream);

    // The meter tap. A branch off the same source, not in the path to the
    // socket, so nothing about what Deepgram receives changes.
    const tap = context.createAnalyser();
    tap.fftSize = METER_FFT_SIZE;
    source.connect(tap);
    meterTap = tap;
    meterSamples = new Float32Array(tap.fftSize);

    const bufferSize = nearestPowerOfTwo((SAMPLE_RATE * CHUNK_MS) / 1000);
    const node = context.createScriptProcessor(bufferSize, 1, 1);
    processor = node;

    node.onaudioprocess = (event) => {
      if (gen !== generation || stopped || !socket) return;

      const input = event.inputBuffer.getChannelData(0);

      // Report loudness before anything that can throw, so the child keeps
      // seeing the waveform react even if the socket has gone away. Peak, not
      // RMS: the wave should jump on a single shouted syllable.
      callbacks.onLevel?.(peakLevel(input));

      // Auto-stop endpointing. A chunk with his voice in it pushes the stop
      // deadline out; AUTO_STOP_SILENCE_MS without one closes the mic. Armed
      // only from a voice chunk, so it stays dormant until he speaks, and a gap
      // between words shorter than the window just resets it.
      //
      // Measured in RMS dB, the same as the meter, and a fixed margin below the
      // level the meter calls "loud enough", so the mic can never give up while
      // the bar is still telling him he is doing fine.
      if (toDbfs(rmsLevel(input)) >= speechFloorDb - AUTO_STOP_MARGIN_DB) {
        armAutoStop(gen);
      }

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
    //
    // Does NOT bump `generation`, and must not: the socket being flushed is
    // still the current one, and its message handler has to keep accepting the
    // transcript CloseStream is about to produce. Identity ends when a new
    // start() replaces it, not here.
    stopped = true;
    teardown(generation);
  }

  /**
   * (Re)start the silence countdown. Called for every chunk of his voice.
   *
   * Carries the generation so a countdown armed by one session cannot close the
   * microphone on the next one, even though teardown() also clears it.
   */
  function armAutoStop(gen: number): void {
    if (autoStopTimer !== null) clearTimeout(autoStopTimer);
    autoStopTimer = setTimeout(() => autoStop(gen), AUTO_STOP_SILENCE_MS);
  }

  /**
   * End the session because he has stopped talking.
   *
   * Same shape as stop(): halt the mic now, keep `abandoned` false so the
   * CloseStream flush still delivers his last words. The one extra step is
   * moving the UI back to idle: a button press routes that through useSpeech,
   * but a stop the source decides on its own has to announce it.
   */
  function autoStop(gen: number): void {
    if (gen !== generation || stopped) return;

    // Released before the UI is told, so 'idle' can never be on screen while the
    // microphone is genuinely still open.
    stopped = true;
    teardown(gen);
    onStatus?.('idle');
  }

  /**
   * Loudness right now as RMS, 0 to 1, straight off the meter tap. Zero when not
   * capturing, so a caller polling every frame needs no extra guard of its own.
   *
   * RMS rather than peak because this one has to predict whether a word will
   * actually be recognised, and peak flatters quiet speech badly. See the note
   * on the dB constants at the top of this file.
   */
  function getLevel(): number {
    if (stopped || meterTap === null || meterSamples === null) return 0;

    meterTap.getFloatTimeDomainData(meterSamples);
    return rmsLevel(meterSamples);
  }

  function isAvailable(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      apiKey.length > 0
    );
  }

  return { start, stop, isAvailable, getLevel };
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

/**
 * Root mean square of the frame, 0 to 1.
 *
 * The energy actually in the audio, as opposed to `peakLevel`'s loudest single
 * sample. Speech routinely peaks 10 to 14 dB above its RMS, so peak reports a
 * softly spoken word as loud: this is the measurement to use for any question of
 * the form "will this be heard".
 */
export function rmsLevel(input: Float32Array): number {
  let sum = 0;

  for (let i = 0; i < input.length; i += 1) {
    sum += input[i] * input[i];
  }

  const rms = Math.sqrt(sum / input.length);
  return rms > 1 ? 1 : rms;
}

/**
 * Amplitude 0 to 1 as dBFS, floored at SILENCE_DB.
 *
 * Full scale is 0 dB and everything real is negative: room tone with noise
 * suppression lands near -50, soft speech near -33, an ordinary voice near -24.
 * The floor keeps digital silence from returning -Infinity and poisoning every
 * arithmetic that touches it.
 */
export function toDbfs(amplitude: number): number {
  if (amplitude <= 0) return SILENCE_DB;

  const db = 20 * Math.log10(amplitude);
  return db < SILENCE_DB ? SILENCE_DB : db;
}

/**
 * `autoGainControl` is not here because it is the adult's choice, and it is
 * always sent explicitly: left out, Chrome and Firefox both switch it on. With it
 * on, the browser turns a quiet room up, so his first word arrives far louder
 * than he said it and the meter jumps before settling to his real level.
 */
const MIC_CONSTRAINTS = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
} as const;

/**
 * Open the microphone the adult chose, or the default when none was chosen.
 *
 * `exact`, not `ideal`. Without a device Firefox opens the system default
 * whenever permission is remembered, which on a machine with several inputs can
 * be a silent one: the button goes green, the meter reads a few dB above digital
 * silence, and nothing is ever heard. `ideal` does not fix that, because a
 * browser may treat it as a hint and open the default anyway, and Chromium
 * does.
 *
 * Device ids are not guaranteed to survive a reload: a browser may rotate them,
 * and Chromium does when the permission is not stored for good. So the choice
 * also carries the mic's name. A stale id falls back to the default, and then,
 * with names now visible, the mic of that name is opened instead. A mic that is
 * simply not plugged in leaves the default open, so the button keeps working.
 *
 * `stillWanted` stops a retry from opening a mic for a session that has ended.
 */
async function openMicrophone(
  deviceId: string | undefined,
  deviceLabel: string | undefined,
  autoGainControl: boolean,
  stillWanted: () => boolean,
): Promise<MediaStream> {
  const devices = navigator.mediaDevices;
  const constraints = { ...MIC_CONSTRAINTS, autoGainControl };
  const openDefault = () => devices.getUserMedia({ audio: { ...constraints } });
  const openExact = (id: string) =>
    devices.getUserMedia({ audio: { ...constraints, deviceId: { exact: id } } });

  if (!deviceId) return openDefault();

  try {
    return await openExact(deviceId);
  } catch (error) {
    if (!isMissingDevice(error) || !stillWanted()) throw error;
  }

  const fallback = await openDefault();
  if (!deviceLabel || !stillWanted()) return fallback;

  // Opening any mic is what makes the names visible, so look for it now.
  const match = await findMicrophoneByLabel(deviceLabel);
  const opened = fallback.getAudioTracks()[0];
  if (!match || opened?.getSettings?.().deviceId === match || !stillWanted()) return fallback;

  try {
    const chosen = await openExact(match);
    fallback.getTracks().forEach((track) => track.stop());
    return chosen;
  } catch {
    return fallback;
  }
}

function isMissingDevice(error: unknown): boolean {
  const name = error instanceof Error ? error.name : '';
  return name === 'OverconstrainedError' || name === 'NotFoundError';
}

async function findMicrophoneByLabel(label: string): Promise<string | null> {
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    const found = list.find(
      (device) => device.kind === 'audioinput' && device.deviceId !== 'default' && device.label === label,
    );
    return found?.deviceId ?? null;
  } catch {
    return null;
  }
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
