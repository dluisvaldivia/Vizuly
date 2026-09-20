/**
 * Letter cards: one deck per letter or sound, loaded from JSON.
 *
 * Mirrors the family's paper cards. The front is the pictogram, the back is the
 * letter over the word, "M / Mesa". The letter can sit anywhere in the word, and
 * one word can belong to several decks (mesa is an M card and an S card).
 *
 * One file per deck in data/letters/{lang}/, plus data/letters/index.{lang}.json
 * for the order the adult sees them in. Each word carries its syllable count so
 * longer words can be added to the same files later and filtered out for now.
 *
 * Plain data and plain functions, no React. Resolution to pictograms happens in
 * useWordCards.ts through the ordinary resolve path, so a card's symbol is the
 * same symbol the strip would show for that word.
 */

import type { Lang } from './types';

export type CardPosition = 'inicial' | 'media';

/** Minimum age of a band: 3 to 5, 6 to 8, 9 to 11. */
export type AgeBand = 3 | 6 | 9;

export interface DeckWord {
  word: string;
  syllables: number;
  /** The youngest band this word is for. Absent means 3, the youngest. */
  age?: AgeBand;
  /** Where the deck's letter sits. Absent for decks the list does not split. */
  position?: CardPosition;
  /** What the back shows, when the letter derived from the deck reads wrong. */
  letter?: string;
}

export interface LetterDeck {
  id: string;
  /** For the adult picking a deck: "B / V", "R suave". */
  label: string;
  /**
   * How the sound is written, longest first where it matters (rr before r).
   * Empty for decks with no single letter, whose cards show only the word.
   */
  graphemes: string[];
  words: DeckWord[];
}

interface DeckIndex {
  decks: string[];
}

const DECK_FILES = import.meta.glob<LetterDeck>('./data/letters/*/*.json', {
  eager: true,
  import: 'default',
});
const INDEX_FILES = import.meta.glob<DeckIndex>('./data/letters/index.*.json', {
  eager: true,
  import: 'default',
});

function buildDecks(lang: Lang): readonly LetterDeck[] {
  const index = INDEX_FILES[`./data/letters/index.${lang}.json`];
  if (!index) return [];

  return index.decks
    .map((id) => DECK_FILES[`./data/letters/${lang}/${id}.json`])
    .filter((deck): deck is LetterDeck => deck !== undefined)
    .map(({ id, label, graphemes, words }) => ({ id, label, graphemes, words }));
}

const DECKS: Record<Lang, readonly LetterDeck[]> = {
  es: buildDecks('es'),
  en: buildDecks('en'),
};

/** Every deck for a language, in picker order. Empty when there are none. */
export function listDecks(lang: Lang): readonly LetterDeck[] {
  return DECKS[lang];
}

export interface CardFilter {
  /** Only words with this many syllables. Omitted means any. */
  syllables?: number;
  /** Only words with the letter here. Omitted means any. */
  position?: CardPosition;
  /** Only words for this band or younger. Omitted means any. */
  age?: AgeBand;
}

/** The words of a deck that pass the filter, in file order. */
export function cardWords(deck: LetterDeck, filter: CardFilter = {}): DeckWord[] {
  return deck.words.filter(
    (entry) =>
      (filter.syllables === undefined || entry.syllables === filter.syllables) &&
      (filter.position === undefined || entry.position === filter.position) &&
      (filter.age === undefined || (entry.age ?? 3) <= filter.age),
  );
}

/**
 * A random order where a well-known word tends to come late and a word to
 * review tends to come early.
 *
 * Weighted sampling without replacement (Efraimidis and Spirakis): each item
 * draws a key of random ** (1 / weight) with weight 2 ** -score, and the list
 * is sorted by key, highest first. A score of 3 is eight times less likely to
 * lead than a score of 0, and -3 eight times more. Every item is always kept:
 * a rating changes order, never membership. Ties keep the original order, so
 * an unrated deck with a constant random source is simply file order.
 */
export function orderByScore<T>(
  items: readonly T[],
  scoreOf: (item: T) => number,
  random: () => number = Math.random,
): T[] {
  return items
    .map((item, index) => ({ item, index, key: random() ** (2 ** scoreOf(item)) }))
    .sort((a, b) => b.key - a.key || a.index - b.index)
    .map(({ item }) => item);
}

/**
 * Drops acute accents and the diaeresis, and nothing else.
 *
 * NOT a general accent strip. The tilde on ñ is a different letter, not a mark:
 * stripping it would make "año" an N card, the same trap as sí and si. So only
 * U+0301 and U+0308 go, and the string is recomposed so ñ stays one character.
 */
export function foldForMatching(text: string): string {
  return text.normalize('NFD').replace(/[\u0301\u0308]/g, '').normalize('NFC').toLowerCase();
}

/**
 * The letter on the back of a card, uppercased, or null for a deck with none.
 *
 * The first of the deck's spellings found in the word, which is why graphemes
 * are listed longest first: perro is "RR", rana is "R", queso is "QU".
 */
export function cardLetter(deck: LetterDeck, entry: DeckWord): string | null {
  if (entry.letter) return entry.letter;

  const folded = foldForMatching(entry.word);
  const found = deck.graphemes.find((grapheme) => folded.includes(grapheme));
  return found ? found.toUpperCase() : null;
}
