# AAC engine

The resolution engine. Plain TypeScript, no React.

See `.claude/rules/ARASAAC-API.md` for the verified API contract before writing any client
code. The brief that this project started from was wrong about the image URL and about how
misses are reported.

## Layout

```
types.ts        shared types
lexicon.ts      stopword lists + lemma maps (es, en), loaded from JSON
tokenize.ts     text -> content words
arasaac.ts      API client. 404 means miss, not error
resolve.ts      word -> pictogram id, cache-first
overrides/      hand-curated word -> id maps per language. Ships empty
useAac.ts       the ONLY module the UI imports
```

## Two rules hold this together

**The engine has zero UI dependencies.** No React imports anywhere in this directory. It
must stay testable as plain functions.

**The UI imports `useAac.ts` and nothing else from here.** Not `resolve`, not `arasaac`, not
`tokenize`. One seam, one import.

## Resolution order

`resolve()` checks three layers in strict order and stops at the first hit:

1. **localStorage cache.** Returns directly, no network.
2. **Overrides map.** Hand-curated correct answers. Beats the API by design.
3. **ARASAAC API.** `bestsearch`, then `search`, then a miss placeholder.

Every result from layers 2 and 3 is written to the cache before returning.

**Never add a cache expiry or a "refresh stale entries" pass.** The cache is the consistency
guarantee, not a performance optimisation. ARASAAC's ranking can change under us, and the
cache is what keeps the child's symbols stable when it does. A word must map to the same
pictogram forever.

## `resolve(word, lang)` is the v2 swap point

Its signature must stay clean enough that swapping the local implementation for an API call
is a one-file change touching no UI code. Do not leak cache mechanics, ARASAAC response
shapes, or network state through it.

## Wrong symbols

The fix for a wrong pictogram is **an entry in `overrides/`**, never a ranking heuristic.
One was tried and rejected; see `.claude/rules/ARASAAC-API.md`.

The overrides map ships empty by decision, and is populated from real use.

Known trap: `bestsearch/papá` returns a potato, because accent-insensitivity collides "papá"
with "papa". Verified fix, ready to paste into the Spanish overrides file:

```json
{ "papá": 31146 }
```

Other Spanish accent collisions are likely and have not been enumerated.

## Testing

`tokenize.ts` and `resolve.ts` have unit tests. That is deliberate: those two hold the logic
that can silently produce a wrong symbol.

`resolve.ts` tests mock the ARASAAC client. **Do not write tests that hit the live API.**

## Language

These modules are TypeScript. The UI stays JSX. This is intentional, not a migration in
progress. Do not convert the UI to TSX.

## Accents are preserved, never stripped

`normalize()` lowercases and strips edge punctuation but leaves accents alone. This is load
bearing:

- `sí` (yes) is core AAC vocabulary and one accent away from `si` (if), which IS a stopword.
  Stripping accents would make the child say "yes" and get nothing back.
- The overrides map is keyed on accented forms, for example `"papá"`.
- ARASAAC is already accent-insensitive, so stripping buys nothing anyway.

`PROTECTED_WORDS` in `lexicon.ts` enforces the first point structurally: core vocabulary is
filtered out of any stopword list at load time, so a future edit to the JSON cannot silently
make the child unheard.
