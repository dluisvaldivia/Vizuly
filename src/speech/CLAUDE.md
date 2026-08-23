# Speech input

Deepgram live streaming, behind a thin interface.

```
types.ts        SpeechSource interface
deepgram.ts     the single implementation
```

Speech lives outside the AAC engine on purpose, so the resolution engine never learns that
speech exists. It receives strings and does not care where they came from.

## The interface exists for v2

`SpeechSource` wraps a single implementation today. That seam is nearly free and is the
designated swap point for the v2 server-proxied Deepgram client. Keep it.

## Deepgram specifics

- Language params: `es` for Spanish, `en-US` for English.
- Key is read from `import.meta.env.VITE_DEEPGRAM_API_KEY`.
- **Browsers cannot set an `Authorization` header on a WebSocket.** The `Authorization: Token`
  recipe from Deepgram's CLI docs does not port to browser JavaScript. `@deepgram/sdk` is
  required because it passes the key via the WebSocket subprotocol instead.

## Failure must be survivable

If Deepgram fails to connect, the key is missing, the mic is denied, or the network is down,
**typed input must still work perfectly.** Typed text is a first-class input path, not a
fallback. Never gate the text input on any speech state, and never couple the two.

## Accepted risk: the key is public

Vite inlines every `VITE_`-prefixed variable into the built bundle. `npm run deploy`
therefore publishes the Deepgram key inside public JavaScript on GitHub Pages, where anyone
can extract and spend it.

This is a known, accepted tradeoff, taken deliberately to keep v1 fast to build. Mitigation
is a hard usage limit on the Deepgram project plus periodic key rotation. It is also the
single strongest argument for the v2 server-side proxy.

**Do not re-open this decision unprompted. Do not commit `.env`.**

## Two silent failures, both verified against the live API

**`connect()` returns a CLOSED socket.** `client.listen.v1.connect(args)` resolves with a
socket in `readyState 3`. Register the event handlers, then call `socket.connect()` to open
it. Skipping that call produces no error and no `open` event: the mic button looks like it is
working while nothing is transmitted at all.

**`CloseStream` is required on stop.** Without sending `{ type: 'CloseStream' }` before
closing, Deepgram never emits the final transcript for the utterance in flight, so the last
thing the child said before pressing stop is lost. The implementation sends it and then waits
`FLUSH_GRACE_MS` before closing.

That flush is also why there are two flags. `stopped` halts the microphone immediately;
`abandoned` gates transcript delivery and only flips once the grace window closes. Gating
transcripts on `stopped` alone would throw away the very transcript the flush exists to
recover.
