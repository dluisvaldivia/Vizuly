/**
 * Spanish syllable splitting, by rule.
 *
 * Exists so a tap on a pictogram can say "cabeza, ca-be-za": the whole word
 * first, then the word broken down. Splitting is the second half of that, and
 * it has to be right, because a wrong split spoken out loud teaches the child
 * something false.
 *
 * Spanish syllabification is genuinely rule-based, so a small hand-written
 * splitter is correct rather than approximate. It is the same argument as the
 * lemma map in lexicon.ts: for this vocabulary a curated rule set beats a
 * library, and a human can debug it at 11pm.
 *
 * English gets no splitter. English syllable boundaries need a pronunciation
 * dictionary, so `syllabify(word, 'en')` returns the whole word as one piece on
 * purpose. Saying the word once is correct; inventing "co-me" is not.
 *
 * Accents are load-bearing here, exactly as in tokenize.ts, and are never
 * stripped: `día` is three syllables' worth of hiatus, `dia` would be two.
 */

import type { Lang } from './types';

/** Vowels that can carry a syllable on their own. */
const STRONG = new Set(['a', 'e', 'o', 'á', 'é', 'ó']);
/** Weak vowels, which glide into an adjacent strong one. */
const WEAK = new Set(['i', 'u', 'ü']);
/** A written accent on a weak vowel breaks the diphthong: dí-a, pú-a. */
const ACCENTED_WEAK = new Set(['í', 'ú']);

/** Digraphs: one sound, and never split. */
const DIGRAPHS = new Set(['ch', 'll', 'rr']);

/**
 * Two-consonant onsets that move whole to the next syllable.
 *
 * `qu` and `gu` are here for the silent-u spelling (a-quí, ju-gue-te). The u in
 * agua is a real vowel and never reaches this set, because it is classified as
 * a vowel rather than a consonant.
 */
const ONSETS = new Set([
  'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr',
  'pl', 'pr', 'tl', 'tr', 'qu', 'gu',
]);

const isVowelLetter = (c: string) => STRONG.has(c) || WEAK.has(c) || ACCENTED_WEAK.has(c);

/**
 * Which characters count as vowels, position by position.
 *
 * Two spellings need the position and not just the letter:
 *  - the u of `qu` and of `gue`/`gui` is silent, so it belongs to the onset
 *  - `y` is a consonant except at the end of a word, where it is a glide (hay)
 */
function vowelMask(lower: string): boolean[] {
  return [...lower].map((c, i) => {
    if (c === 'u' && i > 0 && (lower[i - 1] === 'q' || lower[i - 1] === 'g')) {
      const next = lower[i + 1];
      if (next === 'e' || next === 'i' || next === 'é' || next === 'í') return false;
    }
    if (c === 'y') return lower.length === 1 || (i === lower.length - 1 && i > 0 && isVowelLetter(lower[i - 1]));
    return isVowelLetter(c);
  });
}

/** True when two adjacent vowels are a hiatus and belong to different syllables. */
function isHiatus(a: string, b: string): boolean {
  if (ACCENTED_WEAK.has(a) || ACCENTED_WEAK.has(b)) return true;
  return STRONG.has(a) && STRONG.has(b);
}

/** True when a two-consonant sequence must stay together as one onset. */
const isOnsetCluster = (pair: string) => DIGRAPHS.has(pair) || ONSETS.has(pair);

/**
 * Splits one word into syllables.
 *
 * Always returns at least one element, so callers never special-case a miss:
 * English, an empty string and a word with no vowels all come back whole.
 */
export function syllabify(word: string, lang: Lang): string[] {
  if (lang !== 'es' || word.length === 0) return [word];

  const lower = word.toLowerCase();
  const isV = vowelMask(lower);
  const n = word.length;

  const syllables: string[] = [];
  let current = '';
  let i = 0;

  while (i < n) {
    // Consonants before the nucleus just attach to the syllable being built.
    if (!isV[i]) {
      current += word[i];
      i += 1;
      continue;
    }

    // The nucleus: this vowel plus any that glide onto it.
    let end = i + 1;
    while (end < n && isV[end] && !isHiatus(lower[end - 1], lower[end])) end += 1;
    current += word.slice(i, end);
    i = end;

    // The consonants between this nucleus and the next vowel decide the break.
    let next = i;
    while (next < n && !isV[next]) next += 1;
    if (next >= n) {
      current += word.slice(i);
      break;
    }

    const consonants = word.slice(i, next);
    const pair = lower.slice(next - 2, next);
    // One consonant opens the next syllable (ca-sa). With more, only a digraph
    // or an inseparable cluster travels with it (co-che, som-bra, ins-tru-men-to).
    const keep =
      consonants.length <= 1
        ? 0
        : isOnsetCluster(pair)
          ? consonants.length - 2
          : consonants.length - 1;

    current += consonants.slice(0, keep);
    syllables.push(current);
    current = consonants.slice(keep);
    i = next;
  }

  if (current.length > 0) syllables.push(current);

  // No vowels at all produces no break. Give the caller the word back.
  return syllables.length > 0 ? syllables : [word];
}

/**
 * Whether a word's syllables can be said out loud one at a time without
 * changing how they sound.
 *
 * Spanish writes two different r sounds with the same letter: at the start of a
 * word it is the trill of "perro", between vowels it is the tap of "cara". A
 * synthesizer applies the word-initial rule to anything after a pause, so the
 * syllable "ro" of "quiero" comes back as "rro".
 *
 * There is no way out through spelling or punctuation. Every separator that
 * creates an audible pause also creates a word boundary, and every separator
 * that avoids the word boundary also removes the pause, verified against the
 * live API. So these words are simply not split: the word is said whole and
 * correctly, once.
 *
 * That is the right trade. The syllable pass exists to teach which letters make
 * which sounds, and teaching "quie-rro" would poison exactly the lesson it is
 * there to give. Sixteen of the two hundred words in the list are affected.
 */
export function canSplitAloud(word: string, lang: Lang): boolean {
  if (lang !== 'es') return false;

  const syllables = syllabify(word, lang);
  if (syllables.length < 2) return false;

  // The first syllable is word-initial anyway, so its r is already the trill
  // both in the word and on its own. Only the later ones change.
  return !syllables.slice(1).some((syllable) => {
    const lower = syllable.toLowerCase();
    return lower.startsWith('r') && !lower.startsWith('rr');
  });
}

/**
 * The syllables to say out loud, or an empty list when the word should only be
 * said whole.
 *
 * The single source of truth for the syllable pass: the build-time generator,
 * the live generator and the browser fallback all ask this, so a word can never
 * be split one way in a recorded clip and another way in the fallback.
 */
export function syllablesForSpeech(word: string, lang: Lang): string[] {
  return canSplitAloud(word, lang) ? syllabify(word, lang) : [];
}
