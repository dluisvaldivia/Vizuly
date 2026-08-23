/**
 * Stopword lists and lemma maps per language, loaded from JSON.
 *
 * Hand-curated on purpose. For a closed child vocabulary a curated map beats a
 * full NLP library, and it is debuggable by a human at 11pm when a symbol is
 * wrong. Do not add spaCy or compromise.js. See .claude/rules/ROADMAP.md.
 */

import type { Lang, Lexicon } from './types';

import stopwordsEs from './data/stopwords.es.json';
import stopwordsEn from './data/stopwords.en.json';
import lemmasEs from './data/lemmas.es.json';
import lemmasEn from './data/lemmas.en.json';

/**
 * Words that must NEVER be treated as function words, even if someone adds them
 * to a stopword list by mistake.
 *
 * These are core AAC vocabulary: they are frequently the entire content of what
 * the child is telling us. Dropping "no" from "no quiero" inverts the meaning,
 * and dropping "más" loses the request altogether.
 *
 * This guard exists because several of these look like function words to anyone
 * skimming a stopword list. Spanish "sí" in particular is one accent away from
 * "si" (if), which IS a stopword. See rule 4 in CLAUDE.md.
 */
const PROTECTED_WORDS: Record<Lang, readonly string[]> = {
  es: ['sí', 'no', 'más', 'menos', 'yo', 'tú', 'él', 'ella', 'mío', 'tuyo'],
  en: ['yes', 'no', 'more', 'less', 'i', 'you', 'he', 'she', 'me', 'mine'],
};

/** JSON comment keys, stripped at load. Lets the data files document themselves. */
const COMMENT_KEY = '_comment';

function buildStopwords(list: readonly string[], lang: Lang): ReadonlySet<string> {
  const protectedWords = new Set(PROTECTED_WORDS[lang]);
  const kept = list.filter((word) => !protectedWords.has(word));

  if (import.meta.env?.DEV && kept.length !== list.length) {
    const removed = list.filter((word) => protectedWords.has(word));
    // Loud on purpose: a protected word in a stopword list is a bug that would
    // otherwise show up as the child being silently ignored.
    console.warn(
      `[lexicon] Ignored protected core-vocabulary words in ${lang} stopwords: ${removed.join(', ')}`,
    );
  }

  return new Set(kept);
}

function buildLemmas(map: Record<string, string>): ReadonlyMap<string, string> {
  return new Map(Object.entries(map).filter(([key]) => key !== COMMENT_KEY));
}

const LEXICONS: Record<Lang, Lexicon> = {
  es: {
    stopwords: buildStopwords(stopwordsEs, 'es'),
    lemmas: buildLemmas(lemmasEs),
  },
  en: {
    stopwords: buildStopwords(stopwordsEn, 'en'),
    lemmas: buildLemmas(lemmasEn),
  },
};

/** The lexicon for a language. Built once at module load, never mutated. */
export function getLexicon(lang: Lang): Lexicon {
  return LEXICONS[lang];
}

/**
 * True if the word is a function word that should be dropped before resolution.
 * Protected core vocabulary always returns false.
 */
export function isStopword(word: string, lang: Lang): boolean {
  return LEXICONS[lang].stopwords.has(word);
}

/**
 * The form to send to ARASAAC. Returns the word unchanged when no rewrite
 * applies, which is the common case.
 */
export function toLookupForm(word: string, lang: Lang): string {
  return LEXICONS[lang].lemmas.get(word) ?? word;
}
