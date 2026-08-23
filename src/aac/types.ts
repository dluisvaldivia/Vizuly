/**
 * Shared types for the AAC engine.
 *
 * This module has no imports and no side effects. Everything else in src/aac
 * depends on it, so keep it free of logic.
 */

/** Supported languages. ARASAAC and Deepgram use different codes, see LANG_CODES. */
export type Lang = 'es' | 'en';

/**
 * Language codes per service. Kept in one place because they disagree:
 * ARASAAC wants a bare two-letter code, Deepgram wants a locale for English.
 */
export const LANG_CODES: Record<Lang, { arasaac: string; deepgram: string }> = {
  es: { arasaac: 'es', deepgram: 'es' },
  en: { arasaac: 'en', deepgram: 'en-US' },
};

/** A single word pulled out of the input, before resolution. */
export interface Token {
  /** The word as the child actually said or typed it, for display and debugging. */
  raw: string;
  /** Lowercased, punctuation stripped. What the lemma map is keyed on. */
  normalized: string;
  /**
   * What we send to ARASAAC. Equals `normalized` unless the lemma map rewrote it,
   * for example quiero -> querer. Kept separate so a wrong lemma is debuggable.
   */
  lookup: string;
}

/**
 * How a word came to have (or not have) a pictogram.
 *
 * This is diagnostic only. The child never sees it. It exists so that when a
 * wrong symbol shows up, it is obvious whether the cache, the overrides map, or
 * the API produced it. See src/aac/CLAUDE.md.
 */
export type ResolutionSource = 'cache' | 'override' | 'api' | 'miss';

/** A word paired with the pictogram it resolved to, or a miss. */
export interface ResolvedWord {
  token: Token;
  /** ARASAAC pictogram id, or null for a miss. Never guess a fallback id. */
  pictogramId: number | null;
  source: ResolutionSource;
}

/** Per-language word lists and rewrite rules. See lexicon.ts. */
export interface Lexicon {
  /** Function words removed before resolution. Rule 2 in CLAUDE.md. */
  stopwords: ReadonlySet<string>;
  /** normalized -> lookup rewrites, mostly verb conjugations ARASAAC cannot handle. */
  lemmas: ReadonlyMap<string, string>;
}
