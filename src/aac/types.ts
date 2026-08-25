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
 * ARASAAC wants a bare two-letter code, Deepgram wants a locale for English,
 * and the browser's speech synthesis wants a full BCP-47 tag for both.
 */
export const LANG_CODES: Record<Lang, { arasaac: string; deepgram: string; voice: string }> = {
  es: { arasaac: 'es', deepgram: 'es', voice: 'es-ES' },
  en: { arasaac: 'en', deepgram: 'en-US', voice: 'en-US' },
};

/**
 * How much of the input reaches the strip.
 *
 * `speech` is the default and the one the child uses to talk: function words are
 * dropped and the output is telegraphic, which is correct AAC output rather than
 * a compromise. See rule 2 in CLAUDE.md.
 *
 * `reading` mirrors ARASAAC's pictographed easy-reading material, where
 * connectors DO appear as schematic symbols. It exists so the app can match what
 * the child already works with on paper.
 */
export type OutputMode = 'speech' | 'reading';

/**
 * How many function words reading mode shows. Cumulative, each tier includes the
 * previous one. The adult picks this in settings; the header toggle only picks
 * the mode. See data/connectors.{lang}.json.
 */
export type ReadingTier = 'connectors' | 'articles' | 'clitics';

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
  /**
   * A fixed pictogram id for a function word kept by reading mode.
   *
   * Present ONLY on connector tokens, which only exist in reading mode. Carrying
   * the id on the token rather than adding a layer inside resolve() is
   * deliberate: it makes it structurally impossible for a connector to leak into
   * speech mode, and it leaves resolve(word, lang) untouched, which is the one
   * obligation the roadmap puts on v1 for the v2 migration.
   */
  connectorId?: number;
}

/**
 * How a word came to have (or not have) a pictogram.
 *
 * This is diagnostic only. The child never sees it. It exists so that when a
 * wrong symbol shows up, it is obvious whether an adult correction, the cache,
 * the overrides map, or the API produced it. See src/aac/CLAUDE.md.
 */
export type ResolutionSource =
  | 'correction'
  | 'cache'
  | 'override'
  | 'api'
  | 'miss'
  | 'connector';

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
