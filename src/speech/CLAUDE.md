# Speech in and speech out

Deepgram live streaming in, pre-generated Deepgram audio out, both behind thin interfaces.

```
types.ts         SpeechSource interface
deepgram.ts      the single input implementation
useSpeech.ts     the only module the UI imports for input
useVoice.ts      the only module the UI imports for output
voiceClips.ts    manifest lookup, playback, live generation
clipStore.ts     IndexedDB for clips generated on the device
voiceBudget.ts   the daily cap on live calls
speakWord.ts     the browser voice, the last fallback
syllables.ts     lives in src/aac, shared by the generator and the fallback
```

Speech lives outside the AAC engine on purpose, so the resolution engine never learns that
speech exists. It receives strings and does not care where they came from.

## Voice output: recorded on demand, kept forever

The voice is Deepgram Aura-2, `aura-2-nestor-es`: masculine, peninsular Spanish, because the
family is in Málaga. It is the `FALLBACK_MODEL` in `voiceClips.ts` and the `DEFAULT_VOICE` in
the generator, and those two must agree.

**Nothing ships pre-recorded.** A word is recorded the first time it appears, and from then on
it lives in IndexedDB on that device and costs nothing ever again. The voice model is part of
the storage key, so changing voices re-records rather than serving half the vocabulary in one
voice and half in another.

Recording starts when the word **appears in the strip**, not when it is tapped. Aura takes
between 0.8 and 2 seconds to answer, measured, which is far too long to leave a child waiting
after a tap. A strip sits on screen longer than that before he reaches it, so the first tap
usually already has the recording. If he beats it, the browser voice speaks immediately and
the recording is ready for the next tap. He never waits for the network.

One attempt per word per session, tracked in `attempted`. Without that, a recording that fails
on a flaky connection would be retried on every resolve and eat the day's budget.

### `npm run voices` is optional, and not part of the build

The generator pre-records words from `src/speech/data/vocabulary.es.json` into
`public/voices/es/` plus a manifest, and anything it produces is committed and free forever.
It exists for when a word should ship with the app rather than be paid for per device. It is
**deliberately not wired into `prebuild`**: CI would then need the key and would bill on every
push, and `npm run build` and `npm run deploy` must keep working with no key and no network.

If you do run it, keep these:

- It is **idempotent**: a clip that already exists for the current voice and manifest version
  is skipped, so adding ten words bills ten words.
- **Accents stay in the file names.** Stripping them would collide `papá` with `papa` and `sí`
  with `si`, the exact distinction the app exists to protect.
- It borrows `syllablesForSpeech` from `src/aac/syllables.ts` through Vite rather than copying
  the rules, so a recorded clip and the browser fallback can never say the same word two ways.

## The r that cannot be split

Spanish writes two different r sounds with one letter: the trill at the start of a word, the
tap between vowels. Every synthesizer applies the word-initial rule after a pause, so the
syllable "ro" of "quiero" comes back as "rro".

There is no way out through punctuation, and this was measured rather than assumed. A hyphen,
a soft hyphen and a zero-width space all produce a **shorter** clip than a comma, because the
synthesizer runs the syllables together and just says the word twice. `speed` is rejected with
a 400. Any separator that creates an audible pause creates a word boundary; any separator that
avoids the word boundary removes the pause.

So `canSplitAloud` in `src/aac/syllables.ts` refuses to split those words, and they are spoken
whole and correctly, once. Sixteen of the two hundred words in the curated list are affected,
`quiero` among them. **Do not "fix" this by adding a separator.** It has been tried against
the live API. The syllable pass exists to teach which letters make which sounds, and teaching
"quie-rro" poisons the lesson it is there to give.

## The order a tap resolves in

1. a clip already on this device, in IndexedDB, from an earlier live generation
2. a pre-generated clip shipped with the app
3. the browser's own voice, plus a transient note telling the adult which word is missing

Step 3 never waits for 1 or 2. The child hears something immediately, always. Nothing is
preloaded: opening the page downloads no audio at all, and a clip is fetched when its
pictogram is tapped.

**Never put an `await` before `play()` or `speak()`.** iOS Safari only allows audio that
starts from a user gesture, and a promise in front of it loses that gesture. This is why
stored clips are read out of IndexedDB when the strip changes and held as object URLs in
memory: the tap itself must be synchronous.

## The budget is the only real limit, and it is per browser

Deepgram offers **no per-key or per-project spending cap**, verified in their docs: only
expiry and scopes. So the only place a limit can live is `voiceBudget.ts`, and it lives in
each browser's own `localStorage`. The site is public, so the true ceiling is `DAILY_LIMIT`
times however many people visit, which is why the number is small rather than generous.

It is 40 because recording happens on appearance: a word that shows up in the strip is
recorded even if nobody taps it, so the budget drains per word seen rather than per word
tapped. Each word is paid for once, ever, so this only binds on a day of genuinely new
vocabulary.

If storage is unavailable, `canSpend` returns false. Without somewhere to count, there is no
limit, and no limit is the one outcome the module exists to prevent.

An adult can switch recording off entirely in the panel, which stops all spending at the price
of the plain browser voice.

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

This is a known, accepted tradeoff, re-confirmed by the owner when the site was made public,
backed by the $200 signup credit and the intention to pull the key if consumption shows up.
Note that Deepgram offers no spending cap to fall back on, so rotation and watching the usage
page are the only mitigations. It is the single strongest argument for the v2 server-side
proxy.

Voice output does not depend on this key at all: it plays committed static files. If the key
is ever removed, the app keeps speaking and only the microphone disappears.

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
