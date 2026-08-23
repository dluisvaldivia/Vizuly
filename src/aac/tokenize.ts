/**
 * Text -> content words.
 *
 * Turns what the child said or typed into the sequence of words that will be
 * resolved to pictograms. Function words are stripped here, which is what makes
 * the output telegraphic: "quiero el agua" -> [querer] [agua].
 *
 * Telegraphic output is correct AAC output, not a compromise. See rule 2.
 */

import type { Lang, Token } from './types';
import { isStopword, toLookupForm } from './lexicon';

/**
 * Characters that end or punctuate a word, stripped from the edges.
 *
 * Deliberately does NOT include the apostrophe or the hyphen, because they sit
 * inside real words ("don't", "abre-latas"). Accents are never touched: "sí"
 * (yes) and "si" (if) are different words, and the overrides map is keyed on
 * accented forms such as "papá". See src/aac/CLAUDE.md.
 */
const EDGE_PUNCTUATION = /^[\s.,!?;:"'`´“”‘’()[\]{}¡¿…]+|[\s.,!?;:"'`´“”‘’()[\]{}¡¿…]+$/gu;

/** Splits on whitespace. Punctuation is handled per-word by normalize(). */
const WHITESPACE = /\s+/u;

/**
 * Lowercase and strip edge punctuation. Accents and internal apostrophes are
 * preserved.
 *
 * Returns an empty string for input that is only punctuation, which the caller
 * filters out.
 */
export function normalize(word: string): string {
  return word.toLowerCase().replace(EDGE_PUNCTUATION, '');
}

/**
 * Split input into content words, dropping function words.
 *
 * Returns an empty array for empty or whitespace-only input. Never throws.
 * Order is preserved, because the pictogram strip reads left to right and the
 * order is the grammar.
 */
export function tokenize(input: string, lang: Lang): Token[] {
  if (!input) return [];

  const tokens: Token[] = [];

  for (const raw of input.split(WHITESPACE)) {
    const normalized = normalize(raw);

    // Pure punctuation, or an empty fragment from a split. Not a word.
    if (!normalized) continue;

    // Function word. Dropping it is what makes the output telegraphic.
    if (isStopword(normalized, lang)) continue;

    tokens.push({
      raw,
      normalized,
      lookup: toLookupForm(normalized, lang),
    });
  }

  return tokens;
}
