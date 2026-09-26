# Scope and roadmap

## v1 in scope

- Two first-class input paths: Deepgram live speech, and typed text
- Spanish and English from day one
- Tokenise, strip function words, resolve each remaining word, render the sequence left to right
- Hand-written stopword and lemma JSON per language
- localStorage cache
- Miss placeholder
- Fully responsive

## v1 explicitly out of scope

Do not build these:

- Any Python backend
- Embeddings or vector search
- Any generative image fallback
- Sign language
- User accounts, progress tracking, scoring, timers, streaks. Child profiles and swipe
  ratings are not this: they are local, unsynced, never shown to the child, and only reorder
  letter cards. An adult can clear them.

Do not add spaCy or compromise.js. For a closed child vocabulary a curated map beats a full
NLP library, and it is debuggable by a human at 11pm when a symbol is wrong.

## Build order

**v1 is complete.** All phases below are built and verified. What remains is your
confirmation on a real device with a real microphone, see "Not yet verified" at the end.

Phase 0 is complete: dependencies, `.env`, git, tsconfig, Vite `base`, HashRouter.

1. **Engine core.** `types.ts`, `lexicon.ts` (stopword + lemma JSON per language),
   `tokenize.ts`. Unit tests for `tokenize.ts`.
2. **Resolution.** `arasaac.ts` client (404 as miss, not an error) and `resolve.ts` with the
   three-layer lookup. Unit tests for `resolve.ts` with the client mocked.
3. **Hook and typed input.** `useAac.ts`, plus the typed-text path and the pictogram strip
   rendered end to end. **First point at which the app is usable by the child**, with zero
   speech code involved.
4. **Speech.** `SpeechSource` interface with the single Deepgram implementation behind it.
   Visible listening indicator. Connection failure must leave the typed path fully working.
5. **Child UI and adult gate.** Large targets, minimal text, adult gesture guarding settings
   and the language toggle, persisted language, visible attribution.
6. **Accessibility pass and deploy.** WAVE audit, then `npm run deploy` verified as a
   genuine one-command operation.

## v2 direction

Design with these in mind. **Do not build them in v1.**

A Python backend adding: spaCy lemmatisation replacing the hand-written lemma map; vector
search over ARASAAC labels for out-of-vocabulary words; confidence scoring with
threshold-based placeholder fallback; correction persistence in SQLite synced across devices
via a short session code; session logging for therapist review; Deepgram proxied server-side
so the key never reaches the bundle; and a generative image fallback for zero-match words
that is permanently cached, so that even the generated image is always the same one.

The only obligation this creates on v1: keep `resolve(word, lang)` clean enough that the
migration is a one-file change touching no UI code.

### The sync backend, built

Profile sync exists: a Cloudflare Worker in `worker/`, with one KV namespace, deployed at
`https://vizuly-sync.vizuly.workers.dev`. It is the whole backend, and it replaces the Node
plus Express and MongoDB Atlas plan below: Workers do not sleep, there is no OS to maintain,
and the free tier covers a handful of devices many times over.

- **Pairing, not accounts**, exactly as sketched below. `/pair` issues a six digit code that
  lasts ten minutes and one use, `/claim` redeems it, and both devices then hold the same
  opaque account id. No email, no password, nothing to log into.
- **It stores one opaque blob per account and never parses it.** The client sends the raw
  localStorage strings for profiles, favourites, ratings and corrections, so a shape change
  in the app needs no change to the Worker.
- **The UI is `SyncPanel.jsx`, inside the adult panel**, behind the same long press as
  everything else there.
- **`VITE_SYNC_URL` switches it on.** Unset, the app has no sync and no sync controls, which
  is what a build with no Worker behind it should look like. Unlike the Deepgram key, this
  URL is safe in the bundle: the Worker holds no key and no name, and its only secret is an
  account id that lives in the adult's own storage.
- **Sending happens when the tab is hidden**, which is also how corrections reach it without
  `src/aac` having to know sync exists.
- **Conflicts are last write wins on the whole snapshot.** Two devices edited between syncs
  and the older push loses. Per-key merging is the upgrade, marked `ponytail:` in
  `syncController.js`.

### Things to keep in mind before the rest of that backend exists

The story generator and the server-side Deepgram key are still unbuilt. Researched, not yet
built.

- **Render is not an option.** Its free tier hibernates on inactivity by design, so the first
  request after a quiet spell waits 20 to 40 seconds. Nothing here may depend on a service
  that sleeps. Its free tier also has no persistent disk, so the SQLite file mentioned above
  would be wiped on every redeploy.
- **Hosts that do not sleep**, in order of how much administration they ask for:
  Oracle Cloud Always Free (a real always-on VM, genuinely free with no time limit, but you
  install and maintain Node, HTTPS and the process supervisor yourself), Fly.io with
  `min_machines_running = 1` (they manage the OS, needs a card on file and can bill past the
  included usage), or a cheap VPS at a few euros a month.
- **Chosen stack was Node plus Express, with MongoDB Atlas free tier** (M0 does not expire,
  unlike Render's managed Postgres), rather than the Python and SQLite sketched above.
  Superseded for sync by the Worker above. Reconsider it only if something genuinely needs a
  long-running process.
- **Pairing, not accounts.** A short one-use code issued by one device and redeemed on the
  other, which returns an opaque device token. No email, no password: this is a child's
  profile, and a login is a security surface with no payoff here.
- **The backend is additive and must never be load-bearing.** Rule 3 (cache-first) and rule 5
  (typed text never depends on the speech connection) already say the child's app works with
  no network. A dead server must cost the favourites sync and the story generator, never the
  pictogram strip.
- **What syncs:** favourites, corrections and ratings. Not the word to pictogram cache, which
  is derivable and whose whole job is to be local.
- The first real job for it is holding the API keys server-side: the story generator's, and
  Deepgram's, which this file already lists above as a v2 goal.

## Deployment

```
npm run deploy    build + publish to GitHub Pages
```

Must stay a genuine one-command operation. Do not add manual steps.

Vite `base` is `/Vizuly/` to match the GitHub Pages repo path. The router is `HashRouter`,
chosen because it needs no `404.html` redirect hack on GitHub Pages. Do not switch back to
`BrowserRouter` without also solving the deep-link 404 problem.

## Not yet verified

Everything below was tested with synthesized audio and a headless browser, which is as far
as automation reaches. These need a human:

- **A real microphone.** The Deepgram path was verified end to end by feeding real Spanish
  speech (generated via Deepgram TTS) through the app's own `createDeepgramSource`, with the
  browser audio APIs stubbed. It transcribed correctly. What is untested is `getUserMedia`
  against actual hardware, and how well nova-2 handles a particular child's articulation.
- **The child.** Pictogram choices that look right to an adult may not read to a child.
  Wrong symbols get an entry in `src/aac/data/overrides.*.json`, never a ranking change.
- **A real tablet.** Touch targets pass the 44px WCAG minimum in a 412px viewport, but
  "large enough for a child's hands" is a judgement only you can make.
- **WAVE.** The audit was done with axe-core (0 violations across 5 states, both themes)
  plus manual keyboard checks. CLAUDE.md specifies WAVE; run it against the deployed URL to
  close that out formally.

## Verified during the build

- ARASAAC resolution against the live API: 40/40 core vocabulary words, image URLs return
  real PNGs, misses return 404 and render placeholders.
- The cache consistency guarantee: every phrase re-resolves entirely from cache on a second
  run, so ARASAAC re-ranking cannot change a symbol the child has already learned.
- Deepgram live transcription of real Spanish speech through the app's own module.
- axe-core WCAG 2.1 AA: 0 violations in light and dark, empty and populated, adult panel open.
- Keyboard: adult gate reachable and operable, Escape closes, focus moves into the dialog.
- Child protection: a short tap on the title does NOT open settings, only a long press does.
