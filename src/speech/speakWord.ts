/**
 * Saying one word out loud.
 *
 * The first audio output in the app. Deliberately the browser's own
 * speechSynthesis rather than a service: it must work offline, instantly, and
 * with no key, and it must keep working when the Deepgram connection is down.
 * Same independence the typed path has from the speech path.
 *
 * The sequence is the whole word, then its syllables: "cabeza, ca-be-za". The
 * whole word comes first because that is the word he is learning; the syllables
 * follow because that is how it is broken down for him on paper.
 *
 * Never throws. A device with no voices simply stays silent, because a child
 * facing an error message is worse than a child facing quiet.
 */

import { LANG_CODES, type Lang } from '../aac/types';
import { syllablesForSpeech } from '../aac/syllables';
import { pronouncedWord } from './speechText';

/** Rate for the whole word. Slightly under natural, still fluent. */
const WORD_RATE = 0.95;
/** Rate for the syllable pass, slower so each piece is distinct. */
const SYLLABLE_RATE = 0.75;

export interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
  /**
   * Whether to follow the word with its syllables. An adult sets this in the
   * panel, and it applies to this fallback voice exactly as it applies to the
   * pre-generated clips, so the two never say different things.
   */
  syllables?: boolean;
}

/** True when this browser can speak at all. */
export function canSpeak(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  } catch {
    return false;
  }
}

/**
 * Speaks `word`, then its syllables when there is more than one.
 *
 * Cancels anything already speaking, so tapping three pictograms in a row says
 * the last one he touched rather than queueing all three.
 *
 * Every utterance is queued synchronously inside the caller's tap handler, and
 * never chained off `onend` or a timer: iOS Safari only allows speech that
 * starts from a user gesture, and a deferred utterance loses that.
 *
 * @param spoken   what to say, as the child said it
 * @param split    what to syllabify: the same word without punctuation
 */
export function speakWord(spoken: string, split: string, lang: Lang, options: SpeakOptions = {}): void {
  const { onStart, onEnd, syllables: withSyllables = true } = options;

  if (!canSpeak() || spoken.trim().length === 0) {
    onEnd?.();
    return;
  }

  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    // syllablesForSpeech, not syllabify: a word whose syllables would change
    // sound in isolation is said whole here too, exactly as in the recorded
    // clips. The two paths must never say the same word differently.
    const syllables = withSyllables ? syllablesForSpeech(split, lang) : [];
    // One syllable means the split says exactly what the word already said, so
    // there is nothing to add by repeating it.
    // The corrected spelling, when there is one: a word a synthesizer reads
    // wrong is usually read wrong by every synthesizer, and the recorded clip
    // and this fallback must not say it two different ways.
    const parts: Array<{ text: string; rate: number }> = [
      { text: pronouncedWord(split, lang) === split ? spoken : pronouncedWord(split, lang), rate: WORD_RATE },
    ];
    if (syllables.length > 1) {
      for (const syllable of syllables) parts.push({ text: syllable, rate: SYLLABLE_RATE });
    }

    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      onEnd?.();
    };

    parts.forEach((part, index) => {
      const utterance = new SpeechSynthesisUtterance(part.text);
      utterance.lang = LANG_CODES[lang].voice;
      utterance.rate = part.rate;

      if (index === 0) utterance.onstart = () => onStart?.();
      if (index === parts.length - 1) utterance.onend = finish;
      // An error anywhere ends the whole sequence, so the speaking indicator
      // cannot get stuck on.
      utterance.onerror = finish;

      synth.speak(utterance);
    });
  } catch {
    onEnd?.();
  }
}
