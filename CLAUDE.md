# Vizuly

An AAC pictogram app. A child speaks a word or short sentence and immediately sees the
matching ARASAAC pictogram sequence.

Built for the owner's son, who has Down syndrome. **Real daily-use tool for a real child
first, portfolio piece second.** When a choice is between "works every single time" and
"looks impressive" or "is architecturally elegant", the child wins.

## Non-negotiable rules

1. **ARASAAC pictograms only, never generated images.** The same word must produce the exact
   same symbol every time. That consistency *is* the learning mechanism; a generative model
   destroys the association being built. Does not get revisited.
2. **A sentence resolves to a symbol sequence, not one image.** Function words stripped.
   Telegraphic output is correct AAC output, not a compromise.
3. **Cache-first resolution, always.** Every `word -> pictogram_id` pair is written to
   localStorage and read from it first. Hard requirement, not an optimisation. No expiry.
4. **Never show nothing, never silently skip a word, never show a wrong symbol.** Misses get
   a clear neutral placeholder.
5. **Typed text never depends on the speech connection.** It is a first-class input path,
   not a fallback.
6. **ARASAAC attribution stays visible in the UI.** CC BY-NC-SA, non-commercial only.

## Where things are documented

| Topic | File |
|---|---|
| ARASAAC API contract, verified | `.claude/rules/ARASAAC-API.md` |
| Child UI, styling, accessibility | `.claude/rules/UI-ACCESSIBILITY.md` |
| Scope, build order, v2, deploy | `.claude/rules/ROADMAP.md` |
| Resolution engine | `src/aac/CLAUDE.md` |
| Deepgram and the API key | `src/speech/CLAUDE.md` |

## Traps to know before you touch anything

- **A missing pictogram is HTTP 404, not an empty array.** Treat it as a miss, not an error.
- **`bestsearch/papá` returns a potato**, via accent collision with "papa". Already fixed by
  `{ "papá": 31146 }` in `src/aac/data/overrides.es.json`. Other accent collisions are
  likely: fix them the same way, never with a ranking change.
- **Accents are preserved, never stripped.** `sí` (yes) is core vocabulary and one accent
  from `si` (if), which is a stopword. Stripping accents makes the child say "yes" and get
  nothing. `PROTECTED_WORDS` in `lexicon.ts` enforces this structurally.
- **Deepgram's `connect()` returns a CLOSED socket.** You must call `socket.connect()` after
  registering handlers. Omitting it fails silently: no error, no open event, and a mic button
  that looks like it works while nothing transmits.
- **Deepgram needs an explicit `CloseStream` on stop**, or the child's last utterance is
  never flushed and is silently lost.
- **Do not add a ranking heuristic.** One was tried and rejected: it fixed some words and
  broke others. Wrong symbols get an overrides entry.
- **The image URL in the original brief is wrong.** Correct pattern is in the ARASAAC rules
  file. Sizes 300, 500, 2500 only.

## Commands

```
npm run dev       vite dev server
npm run build     production build
npm run lint      eslint
npm test          vitest
npm run deploy    build + publish to GitHub Pages
```

## Working agreements

- **Ask before adding any dependency.** No exceptions, including dev dependencies.
- **Never use em dashes** in any output, code, comment, or documentation. Use commas,
  colons, or plain hyphens.
- **Never mention Claude, Anthropic, or any AI tool in git commit messages.** No
  `Co-Authored-By` trailer, no "Generated with" footer, no attribution of any kind. Commits
  are authored by the repository owner alone. This overrides the assistant's default
  commit-trailer behaviour, which would otherwise add one automatically. 
