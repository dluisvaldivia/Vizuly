# AAC engine

The resolution engine. Plain TypeScript, no React.

See `.claude/rules/ARASAAC-API.md` for the verified API contract before writing any client
code. The brief that this project started from was wrong about the image URL and about how
misses are reported.

## Layout

```
types.ts        shared types
lexicon.ts      stopword lists + lemma maps + reading-mode connectors, from JSON
tokenize.ts     text -> content words
arasaac.ts      API client. 404 means miss, not error
corrections.ts  adult fixes made inside the app. Beats everything
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

`resolve()` checks four layers in strict order and stops at the first hit:

0. **Adult correction.** Pinned in the app. Above the cache because the cache holds the
   answer being corrected, so a correction that lost to it would do nothing.
1. **localStorage cache.** Returns directly, no network.
2. **Overrides map.** Hand-curated correct answers. Beats the API by design.
3. **ARASAAC API.** `bestsearch`, then `search`, then a miss placeholder.

Every result from layers 2 and 3 is written to the cache before returning.

**Never add a cache expiry or a "refresh stale entries" pass.** The cache is the consistency
guarantee, not a performance optimisation. ARASAAC's ranking can change under us, and the
cache is what keeps the child's symbols stable when it does. A word must map to the same
pictogram forever.

## Output modes

`tokenize(input, lang, { mode, tier })`. Omitting the options is speech mode, and
**every existing two-argument call must keep behaving exactly as it did**: that is the
signal that reading mode stayed additive.

| mode | function words | who it is for |
|---|---|---|
| `speech` (default) | dropped | the child talking. Telegraphic output is correct AAC output |
| `reading` | kept if the fixed table has a symbol | matching ARASAAC's printed easy-reading material |

Reading mode exists because the child works with pictographed easy-reading sheets on paper,
where connectors DO appear as schematic symbols. It is not a relaxation of rule 2. Speech
mode is still the default and still the one he talks with.

### The connector table is closed, and that is deliberate

`data/connectors.{lang}.json`, grouped into three cumulative tiers
(`connectors` < `articles` < `clitics`). The adult picks the tier in settings; the header
button only picks the mode.

**There is no search and no API fallback for connectors.** `bestsearch/a` returns the
LETTER "a" (3021, 3049) ahead of the connector (7041), and `bestsearch/y` does the same.
Choosing correctly would need a schematic-first ranking rule, which is exactly the heuristic
this project tried and rejected. Every id in the table was verified by hand against the live
API. A word absent from the table drops, exactly as speech mode would drop it: ARASAAC
genuinely has no symbol for some function words, `about` and `their` both 404.

Two invariants, both held by `connectors.test.ts`:

- **Every key is already a stopword.** A key that was not would still be a token in SPEECH
  mode, reach `resolve()`, and change the telegraphic output.
- **No key is protected core vocabulary.** `isStopword` returns false for those first, so
  such an entry would be silently dead while looking meaningful.

### Reading mode does not weaken the guards

`isStopword()` still decides first, in both modes, so `PROTECTED_WORDS` is untouched. And
reading mode revives shipped stopwords but **never a word an adult marked `ignore`**: those
two cases are collapsed into one boolean by `isStopword`, so the reading branch asks
`isAdultIgnored()` separately. Changing how the strip looks must not undo a decision an
adult made about what the child sees.

### Connectors bypass every resolution layer

A connector token carries its id as `Token.connectorId`, and `resolveAll` returns it
directly with `source: 'connector'`, without touching corrections, the cache, the overrides
map or the network. Nothing is written to the cache: the id is already fixed in the shipped
table, and a cache entry would only create a second place to have to change it.

Carrying the id on the token rather than adding a layer inside `resolve()` is the whole
point: it makes it structurally impossible for a connector to leak into speech mode, and it
leaves `resolve(word, lang)` untouched for the v2 swap.

## `resolve(word, lang)` is the v2 swap point

Its signature must stay clean enough that swapping the local implementation for an API call
is a one-file change touching no UI code. Do not leak cache mechanics, ARASAAC response
shapes, or network state through it.

## Wrong symbols

The fix for a wrong pictogram is **a pinned correction or an entry in `overrides/`**, never
a ranking heuristic. One was tried and rejected; see `.claude/rules/ARASAAC-API.md`.

The overrides map ships empty by decision, and is populated from real use.

`corrections.ts` is the same mechanism at runtime, for fixing a symbol on the tablet rather
than in the repo. Three kinds, and the key differs per kind:

| kind | means | keyed on |
|---|---|---|
| `pin` | wrong symbol, here is the right one | the **lookup** form, what `resolve()` sees |
| `ignore` | not a content word, drop it | the **normalized** form, what `tokenize()` sees |
| `flag` | wrong, not fixed yet | the normalized form. Changes nothing |

Two invariants:

- **Corrections are not cache entries and survive `clearCache()`.** Clearing the cache is
  how an adult recovers from bad API answers, so wiping their hand-made fixes with it would
  make one fix undo all the others.
- **`PROTECTED_WORDS` beats `ignore`.** A mistaken tap must not be able to make the child
  unhearable when he says "no".

`exportCorrections()` renders all three kinds, both languages, as JSON for the adult panel.
localStorage is unreadable from outside that browser, so this text is the only way a
correction reaches the repo or another device. Its `pins` sections are
`overrides.{lang}.json` shaped and paste straight in. In v2 this store syncs to SQLite.

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
