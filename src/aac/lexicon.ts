/**
 * Stopword lists and lemma maps per language, loaded from JSON.
 *
 * Hand-curated on purpose. For a closed child vocabulary a curated map beats a
 * full NLP library, and it is debuggable by a human at 11pm when a symbol is
 * wrong. Do not add spaCy or compromise.js. See .claude/rules/ROADMAP.md.
 */

import type { Lang, Lexicon } from './types';
import { isIgnored } from './corrections';

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

/** Built once, so the per-word guard in isStopword stays a set lookup. */
const PROTECTED_SETS: Record<Lang, ReadonlySet<string>> = {
  es: new Set(PROTECTED_WORDS.es),
  en: new Set(PROTECTED_WORDS.en),
};

/** JSON comment keys, stripped at load. Lets the data files document themselves. */
const COMMENT_KEY = '_comment';

function buildStopwords(list: readonly string[], lang: Lang): ReadonlySet<string> {
  const protectedWords = PROTECTED_SETS[lang];
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
 *
 * Two sources, and the guard applies to both:
 *
 *   1. The shipped stopword list.
 *   2. Words an adult marked "ignore" in the app, which is how a gap in the
 *      shipped list gets closed without a code change. English "my" is one:
 *      Spanish already strips "mi", so "my name is Noah" was resolving a
 *      possessive to the "mine" pictogram while the Spanish phrase did not.
 *
 * PROTECTED_WORDS wins over both. An adult cannot make "no" or "sí" disappear
 * by tapping the wrong button, because a child who cannot be heard saying "no"
 * has lost something the app exists to give him.
 */
export function isStopword(word: string, lang: Lang): boolean {
  if (isProtected(word, lang)) return false;

  return LEXICONS[lang].stopwords.has(word) || isIgnored(word, lang);
}

/** True for core vocabulary that must never be dropped. */
export function isProtected(word: string, lang: Lang): boolean {
  return PROTECTED_SETS[lang].has(word);
}

/**
 * The form to send to ARASAAC. Returns the word unchanged when no rewrite
 * applies, which is the common case.
 */
export function toLookupForm(word: string, lang: Lang): string {
  return LEXICONS[lang].lemmas.get(word) ?? word;
}
