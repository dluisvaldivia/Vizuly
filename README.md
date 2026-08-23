# Vizuly

An AAC (augmentative and alternative communication) pictogram app. Say a word or a short
sentence and immediately see the matching ARASAAC pictograms.

Speech and typing are two independent input paths. Both work on their own: if the microphone
is unavailable, typing still works perfectly.

## Getting started

```bash
npm install
cp .env.example .env     # then add your Deepgram API key
npm run dev
```

Open the URL Vite prints. The app is served under `/Vizuly/`.

## Commands

```bash
npm run dev       vite dev server
npm run build     production build
npm run lint      eslint
npm test          vitest
npm run deploy    build + publish to GitHub Pages
```

## How it works

```
speech ─┐
        ├─→ tokenize ─→ lemmatise ─→ resolve ─→ pictogram strip
typing ─┘
```

**tokenize** strips function words, so "quiero el agua" becomes `[quiero] [agua]`.
Telegraphic output is correct AAC output.

**lemmatise** rewrites conjugations, because ARASAAC returns 404 for `quiero` but resolves
`querer`.

**resolve** checks three layers in order and stops at the first hit:

1. **localStorage cache**, so a word always produces the same pictogram, permanently
2. **curated overrides**, hand-verified fixes that beat the API
3. **ARASAAC API**, `bestsearch` then `search`

Layer 1 is the consistency guarantee, not a speed optimisation. The same word must map to the
same symbol forever, because that consistency is how the association is learned.

## Configuration

`VITE_DEEPGRAM_API_KEY` in `.env`. Never commit that file.

Note that Vite inlines `VITE_`-prefixed variables into the built bundle, so deploying
publishes the key. Keep a usage limit on the Deepgram project and rotate the key periodically.

## Documentation

`CLAUDE.md` at the root is the routing map. Detail lives in `.claude/rules/` and in nested
`CLAUDE.md` files under `src/aac/` and `src/speech/`.

## Attribution

Pictograms: Sergio Palao, ARASAAC, Gobierno de Aragón. Licensed
[CC BY-NC-SA](https://creativecommons.org/licenses/by-nc-sa/4.0/). Non-commercial use only.
