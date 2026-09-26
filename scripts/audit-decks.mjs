/**
 * Checks every letter-card word against the live ARASAAC catalogue.
 *
 *   npm run audit:decks          both languages
 *   npm run audit:decks -- es    one language
 *
 * It writes nothing. It answers the two questions that decide whether a deck
 * word is fit for a child, neither of which can be answered from the word alone:
 *
 *   does a pictogram exist?   A word with none shows the child a "?" forever.
 *                             78 Spanish deck words were in that state, all of
 *                             them phonetic filler: ama, ata, echa, sabe, lelo.
 *   is the pictogram safe?    ARASAAC tags its own catalogue, so pipa came back
 *                             tagged smoking/drugs and vino tagged alcoholism.
 *
 * Run it after editing any deck. It is deliberately not part of `npm test`:
 * tests must pass with no network, and a flaky API must never fail the build.
 */
import { readFile, readdir } from 'node:fs/promises';

const API = 'https://api.arasaac.org/api/pictograms';
/** Tags ARASAAC itself uses for things a child's deck must never show. */
const BANNED = new Set(['smoking', 'addiction', 'drugs', 'alcoholism', 'unhealthy habit',
  'weapon', 'war', 'violence', 'gambling', 'disruptive behavior', 'sexuality']);

const langs = process.argv[2] ? [process.argv[2]] : ['es', 'en'];

for (const lang of langs) {
  const dir = new URL(`../src/aac/data/letters/${lang}/`, import.meta.url);
  const words = new Map();
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json'))) {
    const deck = JSON.parse(await readFile(new URL(file, dir), 'utf8'));
    for (const w of deck.words) {
      const key = w.word.toLowerCase();
      words.set(key, [...(words.get(key) ?? []), deck.id]);
    }
  }

  const catalogue = await (await fetch(`${API}/all/${lang}`)).json();
  const byId = new Map(catalogue.map((p) => [p._id, p]));

  const missing = [];
  const unsafe = [];
  for (const [word, decks] of words) {
    let results;
    try {
      const res = await fetch(`${API}/${lang}/bestsearch/${encodeURIComponent(word)}`);
      // A miss is 404, not an empty array. See .claude/rules/ARASAAC-API.md.
      if (!res.ok) { missing.push({ word, decks }); continue; }
      results = await res.json();
    } catch {
      missing.push({ word, decks, note: 'network' });
      continue;
    }
    const top = (Array.isArray(results) ? results : [results])[0];
    const picto = byId.get(top?._id);
    if (!picto) continue;
    const tags = new Set([...(picto.tags ?? []), ...(picto.categories ?? [])]);
    const hits = [...tags].filter((t) => BANNED.has(t));
    if (hits.length || picto.violence || picto.sex) {
      unsafe.push({ word, decks, id: top._id, tags: hits });
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\n[${lang}] ${words.size} words`);
  console.log(`  no pictogram: ${missing.length}`);
  for (const m of missing) console.log(`    ${m.word}  (${m.decks.join(', ')})`);
  console.log(`  unsafe pictogram: ${unsafe.length}`);
  for (const u of unsafe) console.log(`    ${u.word}  ${u.id}  ${u.tags.join(', ')}  (${u.decks.join(', ')})`);
}
