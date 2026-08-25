/**
 * What gets said, as opposed to how a word is spelled.
 *
 * The single place that turns a word into text for a synthesizer, shared by the
 * build-time generator, the live recorder and the browser fallback. Three
 * callers, one wording: a word cannot be said one way in a recorded clip and
 * another way in the fallback.
 *
 * Syllable rules stay in src/aac/syllables.ts, which is linguistics and belongs
 * to the engine. This module is about speech, and it owns the two things that
 * are specific to speaking: how syllables are separated, and which words have
 * to be spelled differently to be read correctly.
 */

import type { Lang } from '../aac/types';
import { syllablesForSpeech } from '../aac/syllables';
import pronunciationEs from './data/pronunciation.es.json';

/** Same convention as the engine's data files: a comment key, stripped at load. */
const COMMENT_KEY = '_comment';

function buildOverrides(raw: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(raw).filter(([key]) => key !== COMMENT_KEY));
}

const OVERRIDES: Record<Lang, Map<string, string>> = {
  es: buildOverrides(pronunciationEs as Record<string, string>),
  en: new Map(),
};

/**
 * How syllables are separated in the text sent to a synthesizer.
 *
 * A comma, because a comma is what produces an audible pause. Measured against
 * the alternatives with Aura-2: a hyphen, a soft hyphen and a zero-width space
 * all produce a SHORTER clip than the comma, because the synthesizer runs the
 * syllables together and simply says the word twice.
 */
const SYLLABLE_SEPARATOR = ', ';

/**
 * The spelling to hand the synthesizer for a word.
 *
 * Usually the word itself. An entry in pronunciation.es.json overrides it, for
 * the words a synthesizer reads wrong: very short ones are the usual culprits,
 * since text normalizers tend to treat them as abbreviations or initials.
 *
 * This changes only what is heard. The strip still shows the real word.
 */
export function pronouncedWord(word: string, lang: Lang): string {
  return OVERRIDES[lang]?.get(word) ?? word;
}

/** True when a word has an entry, for tests and for the generator's reporting. */
export function hasPronunciation(word: string, lang: Lang): boolean {
  return OVERRIDES[lang]?.has(word) ?? false;
}

/**
 * The full text of a clip: the word alone, or the word and then its syllables.
 *
 * The syllables come from the real spelling rather than the override, because
 * the override exists to fix how a synthesizer reads the whole word, and the
 * child is being shown the real letters.
 */
export function speechTextFor(word: string, lang: Lang, withSyllables: boolean): string {
  const spoken = pronouncedWord(word, lang);
  if (!withSyllables) return `${spoken}.`;

  const syllables = syllablesForSpeech(word, lang);
  if (syllables.length < 2) return `${spoken}.`;

  return `${spoken}. ${syllables.join(SYLLABLE_SEPARATOR)}.`;
}
