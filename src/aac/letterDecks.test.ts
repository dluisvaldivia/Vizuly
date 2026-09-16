import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { listDecks, cardWords, cardLetter, foldForMatching, type LetterDeck } from './letterDecks';
import type { Lang } from './types';
import { syllabify } from './syllables';
import { cardToken } from './useWordCards';

const dataDir = fileURLToPath(new URL('./data/letters/', import.meta.url));
const decks = listDecks('es');
const langs = ['es', 'en'] as const;

const findDeck = (lang: Lang, id: string): LetterDeck => {
  const found = listDecks(lang).find((d) => d.id === id);
  if (!found) throw new Error(`no ${lang} deck ${id}`);
  return found;
};
const deck = (id: string) => findDeck('es', id);

/**
 * A leading silent h does not count as the word's first letter: hilo is an I word.
 * Spanish only. English h is pronounced, so hat is an H word.
 */
const withoutSilentH = (word: string, lang: Lang) =>
  lang === 'es' && word.startsWith('h') && !word.startsWith('ch') ? word.slice(1) : word;

const everyDeck = langs.flatMap((lang) => listDecks(lang).map((d) => [`${lang}/${d.id}`, lang, d] as const));

describe.each(langs)('%s deck files', (lang) => {
  it('index lists exactly the files on disk, once each', () => {
    const index = JSON.parse(readFileSync(`${dataDir}index.${lang}.json`, 'utf8')).decks as string[];
    const files = readdirSync(`${dataDir}${lang}`).map((f) => f.replace(/\.json$/, ''));

    expect(new Set(index).size).toBe(index.length);
    expect([...index].sort()).toEqual([...files].sort());
    expect(listDecks(lang).map((d) => d.id)).toEqual(index);
  });

  it('every file id matches its file name', () => {
    for (const id of readdirSync(`${dataDir}${lang}`).map((f) => f.replace(/\.json$/, ''))) {
      expect(JSON.parse(readFileSync(`${dataDir}${lang}/${id}.json`, 'utf8')).id).toBe(id);
    }
  });
});

describe('deck contents', () => {
  it.each(everyDeck)('%s: words are lowercase, unique and non-empty', (_, _lang, d) => {
    expect(d.words.length).toBeGreaterThan(0);
    const words = d.words.map((w) => w.word);
    expect(new Set(words).size).toBe(words.length);
    for (const word of words) expect(word).toBe(word.toLowerCase().trim());
  });

  it.each(decks.map((d) => [d.id, d] as const))('es/%s: syllable counts match the shared syllable rules', (_, d) => {
    for (const { word, syllables } of d.words) {
      expect({ word, syllables: syllabify(word, 'es').length }).toEqual({ word, syllables });
    }
  });

  // English has no syllable rules to check against, on purpose (see syllables.ts),
  // so these counts are checked by hand. This only catches a typo.
  it.each(listDecks('en').map((d) => [d.id, d] as const))('en/%s: syllable counts are 1 to 3', (_, d) => {
    for (const { word, syllables } of d.words) {
      expect({ word, ok: Number.isInteger(syllables) && syllables >= 1 && syllables <= 3 }).toEqual({ word, ok: true });
    }
  });

  it.each(everyDeck.filter(([, , d]) => d.graphemes.length > 0))(
    '%s: every word contains the letter, where its position says',
    (_, lang, d) => {
      for (const { word, position } of d.words) {
        const folded = withoutSilentH(foldForMatching(word), lang);
        const at = (test: (g: string) => boolean) => ({ word, ok: d.graphemes.some(test) });

        expect(at((g) => folded.includes(g))).toEqual({ word, ok: true });
        if (position === 'inicial') expect(at((g) => folded.startsWith(g))).toEqual({ word, ok: true });
        if (position === 'media') expect(at((g) => folded.indexOf(g, 1) > 0)).toEqual({ word, ok: true });
      }
    },
  );
});

describe('foldForMatching', () => {
  it('drops acute accents and diaeresis', () => {
    expect(foldForMatching('Sofá')).toBe('sofa');
    expect(foldForMatching('pingüino')).toBe('pinguino');
  });

  it('never turns ñ into n', () => {
    expect(foldForMatching('año')).toBe('año');
    expect(foldForMatching('año').includes('n')).toBe(false);
  });
});

describe('cardLetter', () => {
  const entry = (word: string) => ({ word, syllables: 2 });

  it('prefers the longer spelling', () => {
    expect(cardLetter(deck('rr'), entry('perro'))).toBe('RR');
    expect(cardLetter(deck('rr'), entry('rana'))).toBe('R');
    expect(cardLetter(deck('k'), entry('queso'))).toBe('QU');
    expect(cardLetter(deck('y-ll'), entry('llave'))).toBe('LL');
  });

  it('shows the spelling this word actually uses', () => {
    expect(cardLetter(deck('b-v'), entry('vaca'))).toBe('V');
    expect(cardLetter(deck('b-v'), entry('bota'))).toBe('B');
    expect(cardLetter(deck('i'), entry('hilo'))).toBe('I');
  });

  it('keeps Ñ distinct from N', () => {
    expect(cardLetter(deck('enye'), entry('año'))).toBe('Ñ');
    expect(cardLetter(deck('n'), entry('año'))).toBeNull();
  });

  it('has no letter for a deck without one', () => {
    expect(cardLetter(deck('trabadas'), entry('árbol'))).toBeNull();
  });

  it('honours a per-word override', () => {
    expect(cardLetter(deck('k'), { word: 'queso', syllables: 2, letter: 'Q' })).toBe('Q');
  });
});

describe('cardWords', () => {
  it('filters by syllables and position', () => {
    const m = deck('m');
    expect(cardWords(m, { syllables: 2 }).some((w) => w.word === 'tomate')).toBe(false);
    expect(cardWords(m, { syllables: 3 }).map((w) => w.word)).toEqual(['tomate']);
    expect(cardWords(m, { position: 'inicial' }).every((w) => w.position === 'inicial')).toBe(true);
    expect(cardWords(m)).toHaveLength(m.words.length);
  });
});

describe('cardToken', () => {
  it('keeps a word tokenize would drop as a stopword', () => {
    // "para" is a function word in the strip, but a card an adult chose.
    const token = cardToken('para', 'es');
    expect(token.raw).toBe('para');
    expect(token.normalized).toBe('para');
  });

  it('still applies the lemma map', () => {
    expect(cardToken('hago', 'es').lookup).toBe('hacer');
  });
});

describe('English', () => {
  const en = (id: string) => findDeck('en', id);
  const entry = (word: string) => ({ word, syllables: 1 });

  it('has decks, starting A to Z', () => {
    expect(listDecks('en').slice(0, 26).map((d) => d.label).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });

  it('shows CK where the word uses it', () => {
    expect(cardLetter(en('c'), entry('cat'))).toBe('C');
    expect(cardLetter(en('c'), entry('duck'))).toBe('CK');
    expect(cardLetter(en('k'), entry('duck'))).toBe('CK');
    expect(cardLetter(en('k'), entry('kite'))).toBe('K');
  });

  it('shows the digraph as one letter', () => {
    expect(cardLetter(en('q'), entry('queen'))).toBe('QU');
    expect(cardLetter(en('sh'), entry('fish'))).toBe('SH');
    expect(cardLetter(en('th'), entry('bath'))).toBe('TH');
  });

  it('counts a word-initial h as the first letter', () => {
    expect(cardWords(en('h'), { position: 'inicial' }).map((w) => w.word)).toContain('hat');
  });

  it('has one-syllable words in every deck, where English decks open', () => {
    for (const d of listDecks('en')) {
      expect({ deck: d.id, count: cardWords(d, { syllables: 1 }).length > 0 }).toEqual({ deck: d.id, count: true });
    }
  });
});
