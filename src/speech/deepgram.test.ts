/**
 * Microphone session lifecycle.
 *
 * These exist because the source produced a mic button that stopped responding
 * entirely until the page was reloaded, and it did so silently: the UI said
 * idle, the source thought it was running, and every press after that was a
 * no-op. Nothing about that is visible in a type or a lint.
 *
 * The whole surface here is the ordering of things that fire late, so the socket
 * and the browser audio API are stubbed and the clock is fake. Nothing touches
 * the live API, exactly as in resolve.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Handlers the source registered, so a test can fire them like Deepgram would. */
interface FakeSocket {
  handlers: Record<string, ((arg?: unknown) => void)[]>;
  on: (event: string, handler: (arg?: unknown) => void) => void;
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  sendMedia: ReturnType<typeof vi.fn>;
  sendCloseStream: ReturnType<typeof vi.fn>;
  sendKeepAlive: ReturnType<typeof vi.fn>;
  emit: (event: string, arg?: unknown) => void;
}

const sockets: FakeSocket[] = [];

/** Resolves the next connect() by hand, so a test can stop mid-connect. */
let pendingConnect: ((socket: FakeSocket) => void) | null = null;
let holdConnect = false;

function makeSocket(): FakeSocket {
  const socket: FakeSocket = {
    handlers: {},
    on(event, handler) {
      (socket.handlers[event] ??= []).push(handler);
    },
    connect: vi.fn(),
    close: vi.fn(),
    sendMedia: vi.fn(),
    sendCloseStream: vi.fn(),
    sendKeepAlive: vi.fn(),
    emit(event, arg) {
      (socket.handlers[event] ?? []).forEach((handler) => handler(arg));
    },
  };
  return socket;
}

vi.mock('@deepgram/sdk', () => ({
  DeepgramClient: class {
    listen = {
      v1: {
        connect: () => {
          const socket = makeSocket();
          sockets.push(socket);

          if (holdConnect) {
            return new Promise<FakeSocket>((resolve) => {
              pendingConnect = resolve;
            });
          }

          return Promise.resolve(socket);
        },
      },
    };
  },
}));

const { createDeepgramSource } = await import('./deepgram');

const track = {
  stop: vi.fn(),
  label: 'USB mic',
  getSettings: () => ({ deviceId: 'usb-mic' }),
};

const getUserMedia = vi.fn();
const enumerateDevices = vi.fn(() => Promise.resolve([] as { kind: string; deviceId: string; label: string }[]));

/** Resolves the next getUserMedia() by hand, so a test can stop mid-prompt. */
let pendingMedia: (() => void) | null = null;
let holdMedia = false;

function stubBrowserAudio() {
  const node = { connect: vi.fn(), disconnect: vi.fn() };
  const media = { getTracks: () => [track], getAudioTracks: () => [track] };

  getUserMedia.mockReset();
  getUserMedia.mockImplementation(() => {
    if (!holdMedia) return Promise.resolve(media);
    return new Promise((resolve) => {
      pendingMedia = () => resolve(media);
    });
  });

  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia, enumerateDevices } });

  vi.stubGlobal(
    'AudioContext',
    class {
      destination = {};
      createMediaStreamSource = () => ({ connect: vi.fn() });
      createAnalyser = () => ({
        fftSize: 0,
        getFloatTimeDomainData: vi.fn(),
        disconnect: vi.fn(),
      });
      createScriptProcessor = () => ({ ...node, onaudioprocess: null });
      createGain = () => ({ gain: { value: 0 }, connect: vi.fn() });
      close = () => Promise.resolve();
    },
  );
}

/** Everything the source can tell the UI, in the order it said it. */
function makeCallbacks() {
  return {
    onFinal: vi.fn(),
    onInterim: vi.fn(),
    onLevel: vi.fn(),
    onStatus: vi.fn(),
    onDevice: vi.fn(),
    onError: vi.fn(),
  };
}

const FINAL = { channel: { alternatives: [{ transcript: 'hola' }] }, is_final: true };

/** connect() is awaited, so the source needs real microtasks to get going. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  sockets.length = 0;
  pendingConnect = null;
  holdConnect = false;
  pendingMedia = null;
  holdMedia = false;
  track.stop.mockClear();
  stubBrowserAudio();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('session lifecycle', () => {
  it('keeps a restart inside the flush window alive', async () => {
    // The reported bug: press, let it stop, press again straight away, and the
    // previous session's flush timer abandoned the new one while its socket's
    // close handler pushed the UI back to idle underneath it.
    const source = createDeepgramSource('key');

    const first = makeCallbacks();
    await source.start('es', first);
    await settle();

    source.stop();

    const second = makeCallbacks();
    await source.start('es', second);
    await settle();
    second.onStatus.mockClear();

    // The old session's grace window closes, taking its socket with it.
    await vi.advanceTimersByTimeAsync(2000);

    // It must not have reported anything about the session that replaced it.
    expect(second.onStatus).not.toHaveBeenCalled();

    // And the new session must still be able to deliver.
    sockets[1].emit('message', FINAL);
    expect(second.onFinal).toHaveBeenCalledWith('hola');
  });

  it('drops a late transcript from a session the child has moved on from', async () => {
    // Otherwise the tail of one utterance is glued onto the front of the next.
    const source = createDeepgramSource('key');

    const first = makeCallbacks();
    await source.start('es', first);
    await settle();

    source.stop();
    await source.start('es', makeCallbacks());
    await settle();

    sockets[0].emit('message', FINAL);
    expect(first.onFinal).not.toHaveBeenCalled();
  });

  it('still delivers the flushed final of the session being stopped', async () => {
    // The other half of the same rule: CloseStream exists precisely so the last
    // thing he said arrives after he pressed stop.
    const source = createDeepgramSource('key');

    const callbacks = makeCallbacks();
    await source.start('es', callbacks);
    await settle();

    source.stop();
    expect(sockets[0].sendCloseStream).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    sockets[0].emit('message', FINAL);
    expect(callbacks.onFinal).toHaveBeenCalledWith('hola');

    // Past the grace window the door is shut.
    callbacks.onFinal.mockClear();
    await vi.advanceTimersByTimeAsync(2000);
    sockets[0].emit('message', FINAL);
    expect(callbacks.onFinal).not.toHaveBeenCalled();
  });

  it('recovers when Deepgram closes the socket on its own', async () => {
    // This is what left the button dead: the handler repainted the UI but never
    // set stopped, so the next start() found the source "already running".
    const source = createDeepgramSource('key');

    const first = makeCallbacks();
    await source.start('es', first);
    await settle();

    sockets[0].emit('close');
    expect(first.onStatus).toHaveBeenCalledWith('idle');

    // The microphone must actually have been released, not just reported.
    expect(track.stop).toHaveBeenCalled();

    // And the next press has to open a genuinely new socket.
    const second = makeCallbacks();
    await source.start('es', second);
    await settle();

    expect(sockets).toHaveLength(2);
    expect(second.onStatus).toHaveBeenCalledWith('connecting');
  });

  it('recovers when the socket errors', async () => {
    const source = createDeepgramSource('key');

    const first = makeCallbacks();
    await source.start('es', first);
    await settle();

    sockets[0].emit('error', new Error('boom'));
    expect(first.onStatus).toHaveBeenCalledWith('error');
    expect(track.stop).toHaveBeenCalled();

    await source.start('es', makeCallbacks());
    await settle();
    expect(sockets).toHaveLength(2);
  });

  it('does not leak a socket when stopped mid-connect', async () => {
    const source = createDeepgramSource('key');

    holdConnect = true;
    void source.start('es', makeCallbacks());
    await settle();

    source.stop();

    // Deepgram answers after the child already gave up.
    holdConnect = false;
    pendingConnect?.(sockets[0]);
    await settle();

    expect(sockets[0].connect).not.toHaveBeenCalled();
    expect(sockets[0].close).toHaveBeenCalled();
    expect(sockets[0].sendKeepAlive).not.toHaveBeenCalled();
  });

  it('starts cleanly even when the caller and the source disagree', async () => {
    // The backstop. However the two get out of step, a press must never be a
    // silent no-op, because that is a button that never works again.
    const source = createDeepgramSource('key');

    const first = makeCallbacks();
    await source.start('es', first);
    await settle();

    // start() again without any stop: the desync the old code refused to act on.
    const second = makeCallbacks();
    await source.start('es', second);
    await settle();

    expect(sockets).toHaveLength(2);
    expect(second.onStatus).toHaveBeenCalledWith('connecting');
  });
});

/**
 * Firefox opens the system default microphone whenever the permission is
 * remembered, not the one the adult picked in its prompt. On a machine with
 * several inputs that default can be silent: a green button that hears nothing.
 */
describe('microphone choice', () => {
  it('asks for exactly the chosen microphone', async () => {
    const source = createDeepgramSource('key');

    await source.start('es', makeCallbacks(), { deviceId: 'usb-mic' });

    // exact, not ideal: Chromium opens the default for an ideal device id.
    expect(getUserMedia.mock.calls[0][0].audio.deviceId).toEqual({ exact: 'usb-mic' });
  });

  it('falls back to the default when the chosen microphone is gone', async () => {
    const source = createDeepgramSource('key');
    const callbacks = makeCallbacks();
    const gone = Object.assign(new Error('no such device'), { name: 'OverconstrainedError' });
    getUserMedia.mockRejectedValueOnce(gone);

    await source.start('es', callbacks, { deviceId: 'unplugged' });
    await settle();

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[1][0].audio).not.toHaveProperty('deviceId');
    expect(callbacks.onStatus).not.toHaveBeenCalledWith('error');
    expect(sockets).toHaveLength(1);
  });

  it('finds the chosen microphone by name when its id has changed', async () => {
    const source = createDeepgramSource('key');
    const callbacks = makeCallbacks();
    const stale = Object.assign(new Error('no such device'), { name: 'OverconstrainedError' });
    getUserMedia.mockRejectedValueOnce(stale);
    // The default opens first, and only then are the names visible.
    const defaultTrack = { ...track, label: 'Built-in', getSettings: () => ({ deviceId: 'builtin' }) };
    getUserMedia.mockResolvedValueOnce({ getTracks: () => [defaultTrack], getAudioTracks: () => [defaultTrack] });
    enumerateDevices.mockResolvedValueOnce([
      { kind: 'audioinput', deviceId: 'builtin', label: 'Built-in' },
      { kind: 'audioinput', deviceId: 'usb-mic', label: 'USB mic' },
    ]);

    await source.start('es', callbacks, { deviceId: 'old-id', deviceLabel: 'USB mic' });
    await settle();

    expect(getUserMedia.mock.calls[2][0].audio.deviceId).toEqual({ exact: 'usb-mic' });
    expect(callbacks.onDevice).toHaveBeenCalledWith('usb-mic', 'USB mic');
  });

  it('keeps the default open when the chosen microphone is not plugged in', async () => {
    const source = createDeepgramSource('key');
    const callbacks = makeCallbacks();
    const gone = Object.assign(new Error('no such device'), { name: 'OverconstrainedError' });
    getUserMedia.mockRejectedValueOnce(gone);
    enumerateDevices.mockResolvedValueOnce([{ kind: 'audioinput', deviceId: 'usb-mic', label: 'Other mic' }]);

    await source.start('es', callbacks, { deviceId: 'old-id', deviceLabel: 'Unplugged mic' });
    await settle();

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(callbacks.onStatus).not.toHaveBeenCalledWith('error');
  });

  it('still reports a real failure, such as a denied permission', async () => {
    const source = createDeepgramSource('key');
    const callbacks = makeCallbacks();
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    getUserMedia.mockRejectedValueOnce(denied);

    await source.start('es', callbacks, { deviceId: 'usb-mic' });

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(callbacks.onStatus).toHaveBeenCalledWith('error');
  });

  it('asks for no particular microphone when none was chosen', async () => {
    const source = createDeepgramSource('key');

    await source.start('es', makeCallbacks());

    expect(getUserMedia.mock.calls[0][0].audio).not.toHaveProperty('deviceId');
  });

  // Left out, browsers switch gain control on, and the meter jumps on his first
  // word. So it is always sent, and off unless the adult asked for it.
  it('turns automatic gain control off unless asked', async () => {
    const source = createDeepgramSource('key');

    await source.start('es', makeCallbacks());

    expect(getUserMedia.mock.calls[0][0].audio.autoGainControl).toBe(false);
  });

  it('keeps the gain choice on every microphone it tries', async () => {
    const source = createDeepgramSource('key');
    const gone = Object.assign(new Error('no such device'), { name: 'OverconstrainedError' });
    getUserMedia.mockRejectedValueOnce(gone);

    await source.start('es', makeCallbacks(), { deviceId: 'unplugged', autoGainControl: true });
    await settle();

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[0][0].audio.autoGainControl).toBe(true);
    expect(getUserMedia.mock.calls[1][0].audio.autoGainControl).toBe(true);
  });

  it('reports the microphone the browser really opened', async () => {
    const source = createDeepgramSource('key');
    const callbacks = makeCallbacks();

    await source.start('es', callbacks);

    expect(callbacks.onDevice).toHaveBeenCalledWith('usb-mic', 'USB mic');
  });

  it('does not report a microphone for a session already replaced', async () => {
    const source = createDeepgramSource('key');
    const first = makeCallbacks();

    holdMedia = true;
    void source.start('es', first);
    await settle();

    // Stopped while the permission prompt was still open.
    source.stop();
    pendingMedia?.();
    await settle();

    expect(first.onDevice).not.toHaveBeenCalled();
  });
});
