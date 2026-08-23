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
- User accounts, progress tracking, scoring, timers, streaks

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
  against actual hardware, and how well nova-2 handles this particular child's articulation.
- **The child himself.** Pictogram choices that look right to an adult may not read to him.
  Wrong symbols get an entry in `src/aac/data/overrides.*.json`, never a ranking change.
- **A real tablet.** Touch targets pass the 44px WCAG minimum in a 412px viewport, but
  "large enough for his hands" is a judgement only you can make.
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
