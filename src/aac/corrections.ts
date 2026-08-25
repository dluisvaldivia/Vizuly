/**
 * Adult corrections, made from inside the app.
 *
 * The shipped overrides map fixes wrong symbols at build time. This is the same
 * idea at runtime: when the child says a word and gets the wrong pictogram, or
 * no pictogram, or a word that should never have been resolved at all, an adult
 * fixes it on the spot and the fix is permanent.
 *
 * Three kinds, because real use produces three different problems:
 *
 *   pin     the word resolved to the wrong symbol, here is the right one.
 *           "noah" -> the biblical ark, when it is the child's own name.
 *   ignore  the word is a function word this language's stopword list missed.
 *           English "my" resolving to the "mine" pictogram, where Spanish
 *           already strips "mi".
 *   flag    something is wrong here and the adult cannot fix it right now.
 *           Changes nothing about what the child sees. It is a note to self,
 *           listed in the adult panel.
 *
 * DELIBERATELY SEPARATE FROM cache.ts. A correction is not a cached answer:
 *
 *   - It must beat the cache, because the cache already holds the wrong answer.
 *     That is the whole reason the adult is correcting it.
 *   - "Clear saved pictograms" must NOT wipe it. Clearing the cache is how an
 *     adult recovers from bad API answers, and it would be cruel for that to
 *     also destroy every fix they had already made by hand.
 *
 * In v2 this store is what syncs to SQLite across devices. Keep it a plain
 * word -> correction map so that migration stays a data copy.
 */

import type { Lang } from './types';

/** Versioned so a future format change cannot silently misread old entries. */
const CORRECTION_PREFIX = 'vizuly.correction.v1';

/** What an adult decided about one word. */
export type Correction =
  | { kind: 'pin'; pictogramId: number }
  | { kind: 'ignore' }
  | { kind: 'flag' };

/** A correction together with the word and language it belongs to. */
export interface CorrectionEntry {
  word: string;
  lang: Lang;
  correction: Correction;
}

function correctionKey(word: string, lang: Lang): string {
  return `${CORRECTION_PREFIX}.${lang}.${word}`;
}

/**
 * Storage access is guarded everywhere, same reasoning as cache.ts: Safari
 * private mode, disabled site data and full quotas all throw, and none of them
 * should cost the child the app.
 */
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable or full. The correction applies to the current strip
    // in memory, it just will not survive a reload. Degrade, never throw.
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing useful to do.
  }
}

/** Serialised form. Kept human readable so a stuck entry is fixable by hand. */
function serialise(correction: Correction): string {
  return correction.kind === 'pin' ? `pin:${correction.pictogramId}` : correction.kind;
}

function parse(raw: string): Correction | null {
  if (raw === 'ignore') return { kind: 'ignore' };
  if (raw === 'flag') return { kind: 'flag' };

  if (raw.startsWith('pin:')) {
    const id = Number.parseInt(raw.slice(4), 10);
    // Corrupt or hand-edited. Treat as absent so the word resolves normally
    // rather than rendering a pictogram id that does not exist.
    return Number.isInteger(id) ? { kind: 'pin', pictogramId: id } : null;
  }

  return null;
}

/** What an adult has decided about this word, or null if nothing. */
export function readCorrection(word: string, lang: Lang): Correction | null {
  const raw = safeGet(correctionKey(word, lang));
  return raw === null ? null : parse(raw);
}

/** Record a decision. Replaces any previous one for the same word. */
export function setCorrection(word: string, lang: Lang, correction: Correction): void {
  safeSet(correctionKey(word, lang), serialise(correction));
}

/**
 * Undo one decision.
 *
 * Every correction is reversible from the adult panel, which is what makes the
 * long-press entry point safe: if the child reaches the fix dialog and pins
 * something wrong, an adult can always take it back.
 *
 * This does NOT clear the cache entry underneath, so the word falls back to
 * whatever it resolved to before. That is what "undo my change" should mean.
 */
export function removeCorrection(word: string, lang: Lang): void {
  safeRemove(correctionKey(word, lang));
}

/** True when an adult marked this word as one to skip, like a stopword. */
export function isIgnored(word: string, lang: Lang): boolean {
  return readCorrection(word, lang)?.kind === 'ignore';
}

/**
 * Every correction, both languages, sorted by word.
 *
 * Drives the adult panel's review list, which is the only place a flag is
 * visible and the only place a correction can be undone.
 */
export function listCorrections(): CorrectionEntry[] {
  const entries: CorrectionEntry[] = [];

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(`${CORRECTION_PREFIX}.`)) continue;

      // Key shape is prefix.LL.word. The language code is always two
      // characters, so the word is everything after it. Never split on dots:
      // a word can legitimately contain one.
      const rest = key.slice(CORRECTION_PREFIX.length + 1);
      const lang = rest.slice(0, 2);
      const word = rest.slice(3);

      if ((lang !== 'es' && lang !== 'en') || !word) continue;

      const correction = parse(safeGet(key) ?? '');
      if (correction) entries.push({ word, lang, correction });
    }
  } catch {
    // Storage unavailable. An empty list is honest: nothing is persisted.
  }

  return entries.sort((a, b) => a.word.localeCompare(b.word));
}

/**
 * The pinned corrections for one language, shaped exactly like
 * `data/overrides.{lang}.json`.
 *
 * Kept as its own function because that file holds only word -> id, so the
 * `pins` object below can be pasted into it verbatim.
 */
export function exportPins(lang: Lang): Record<string, number> {
  const pins: Record<string, number> = {};

  for (const entry of listCorrections()) {
    if (entry.lang === lang && entry.correction.kind === 'pin') {
      pins[entry.word] = entry.correction.pictogramId;
    }
  }

  return pins;
}

/** One language's section of the export. */
interface ExportedLang {
  /** word -> pictogram id. Paste straight into `data/overrides.{lang}.json`. */
  pins: Record<string, number>;
  /** Words an adult dropped. Candidates for the shipped stopword list. */
  ignored: string[];
  /** Words an adult marked wrong but did not fix. The reason this exists. */
  flagged: string[];
}

/**
 * Everything, as text, for getting it off the device.
 *
 * localStorage is invisible from outside the browser it lives in: it cannot be
 * read from the repo, from another device, or by anyone the adult asks for
 * help. A flag that only exists there is a note nobody else can act on, which
 * defeats the point of flagging.
 *
 * So the adult panel renders this and the adult copies it. Deliberately plain
 * JSON with no schema of its own beyond what is here: it gets pasted into a
 * chat, a file, or an issue, and it has to be obvious to a human reading it
 * cold.
 *
 * Includes all three kinds. `pins` alone is `exportPins`.
 */
export function exportCorrections(): string {
  const byLang: Record<Lang, ExportedLang> = {
    es: { pins: {}, ignored: [], flagged: [] },
    en: { pins: {}, ignored: [], flagged: [] },
  };

  for (const entry of listCorrections()) {
    const section = byLang[entry.lang];

    if (entry.correction.kind === 'pin') {
      section.pins[entry.word] = entry.correction.pictogramId;
    } else if (entry.correction.kind === 'ignore') {
      section.ignored.push(entry.word);
    } else {
      section.flagged.push(entry.word);
    }
  }

  return JSON.stringify(
    {
      _comment:
        'Vizuly corrections, exported from the device. pins -> src/aac/data/overrides.{lang}.json. ignored -> candidates for src/aac/data/stopwords.{lang}.json. flagged -> wrong, not yet fixed.',
      exported: new Date().toISOString(),
      es: byLang.es,
      en: byLang.en,
    },
    null,
    2,
  );
}
