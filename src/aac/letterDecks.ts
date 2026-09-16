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

export interface DeckWord {
  word: string;
  syllables: number;
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
}

/** The words of a deck that pass the filter, in file order. */
export function cardWords(deck: LetterDeck, filter: CardFilter = {}): DeckWord[] {
  return deck.words.filter(
    (entry) =>
      (filter.syllables === undefined || entry.syllables === filter.syllables) &&
      (filter.position === undefined || entry.position === filter.position),
  );
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
