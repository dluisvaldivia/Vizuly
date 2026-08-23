# ARASAAC API reference

Verified live against `api.arasaac.org` on 2026-08-23. Several of these contradict ARASAAC's
own docs and the original project brief.

**Trust this file over any prose description, including future ones. If in doubt, re-probe
the API rather than guessing.**

Base URL: `https://api.arasaac.org/api`
No API key required. `Access-Control-Allow-Origin: *` on both the API and the static CDN,
so the browser can call it directly.

## Image URLs

```
https://static.arasaac.org/pictograms/{id}/{id}_{size}.png
```

Confirmed sizes: `300`, `500`, `2500`. **`100` does not exist and 404s.**

`https://static.arasaac.org/images/...` is **wrong** and 404s. It appears in the original
brief. Do not use it.

## Search endpoints

```
GET /pictograms/{lang}/bestsearch/{word}    exact-ish match
GET /pictograms/{lang}/search/{word}        broader, fuzzier
```

- **A miss returns HTTP 404, not an empty 200 array.** The client must treat 404 as "no
  match found" and return a miss, not throw. This is the single easiest thing to get wrong.
- `bestsearch` handles **plurals** (`gatos` -> gato, `cats` -> cat) and is
  **accent-insensitive** (`mama` -> mamá).
- `bestsearch` does **not** handle verb conjugations. `bestsearch/quiero` returns 404 while
  `bestsearch/querer` returns 200. This is exactly the gap the lemma map in `lexicon.ts`
  exists to fill, and it is why a hand-written lemma map is genuinely necessary rather than
  merely convenient.
- `search` is broader but noisier. It surfaces "gato" the carpentry jack, "Papá Noel"
  sleighs, and similar. Prefer `bestsearch`, fall back to `search`.

## Coverage

Probed 40 core child vocabulary words, 20 Spanish and 20 English. **40/40 resolved, zero
misses.** Coverage is not a concern for this vocabulary. Correctness of the chosen symbol is.

## Ranking is not trustworthy

A heuristic re-rank was tried (prefer `aac: true`, then `schematic`, then lowest `_id`) and
**rejected**. It fixed `perro`, `casa` and `dormir` but broke `quiero` (returned "quiero
más") and `ayuda`. There is no automatic ranking rule that is safe across this vocabulary.

Do not add one. The correct mechanism for a wrong symbol is an entry in the overrides map.

## British English

ARASAAC's English is British: `mom` -> "mum", `cookie` -> "biscuit", `bathroom` -> "toilet".
All resolve correctly, only the returned label differs. He does not read, so this is
cosmetic and needs no fix.

## Licence

CC BY-NC-SA. Non-commercial use only. Attribution must stay visible in the UI:

```
Pictogramas: Sergio Palao, ARASAAC, Gobierno de Aragón. CC BY-NC-SA.
```
