/**
 * The pre-generated Aura-2 clips, and the live fill-in for anything else.
 *
 * The manifest is imported, not fetched: the app knows instantly and offline
 * whether it has audio for a word, with no 404 round trip to find out.
 *
 * Nothing here preloads. A clip is requested when its pictogram is tapped and
 * not before, so opening the page downloads no audio at all.
 */

import { LANG_CODES, type Lang } from '../aac/types';
import { syllablesForSpeech } from '../aac/syllables';
import { speechTextFor } from './speechText';
import { clipKey, getClip, putClip } from './clipStore';
import { canSpend, spend } from './voiceBudget';
import rawManifest from './data/voices.manifest.json';

/** Whole word, or word then syllables. */
export type ClipMode = 'word' | 'syllables';

interface ManifestEntry {
  word: string;
  syllables?: string;
}

interface Manifest {
  version: number;
  model: string;
  generated?: string;
  clips: Record<string, Record<string, ManifestEntry>>;
}

const manifest = rawManifest as Manifest;

const SPEAK_URL = 'https://api.deepgram.com/v1/speak';
/** Matches scripts/generate-voices.mjs, so live clips sound like the rest. */
const AUDIO_PARAMS = 'encoding=mp3&bit_rate=32000';
/** Only used before the first generation run has written a model in. */
const FALLBACK_MODEL = 'aura-2-nestor-es';

export const voiceModel = manifest.model || FALLBACK_MODEL;

/**
 * Which clip a word wants, given the adult's syllable setting.
 *
 * A word that cannot be split without changing how it sounds asks for the plain
 * clip even with syllables switched on. See canSplitAloud in syllables.ts.
 */
export function clipModeFor(word: string, lang: Lang, syllablesOn: boolean): ClipMode {
  if (!syllablesOn) return 'word';
  return syllablesForSpeech(word, lang).length > 1 ? 'syllables' : 'word';
}

/**
 * The URL of a pre-generated clip, or null when there is none.
 *
 * BASE_URL is not optional here. The site is served from /Vizuly/, so a bare
 * /voices/... path would 404 on the deployed build while working perfectly in
 * dev, which is the worst way for this to break.
 */
export function staticClipUrl(word: string, lang: Lang, mode: ClipMode): string | null {
  const entry = manifest.clips?.[lang]?.[word];
  if (!entry) return null;

  // A one-syllable word has no syllable clip, and the whole-word one says the
  // same thing anyway.
  const file = mode === 'syllables' ? (entry.syllables ?? entry.word) : entry.word;
  if (!file) return null;

  return `${import.meta.env.BASE_URL}voices/${lang}/${encodeURIComponent(file)}`;
}

export interface PlayOptions {
  onStart?: () => void;
  onEnd?: () => void;
  /** Called when the audio cannot play at all, so the caller can fall back. */
  onFail?: () => void;
}

/**
 * Plays a clip.
 *
 * Must be called synchronously from the tap handler, with no await in front of
 * it: iOS Safari only allows audio that starts from a user gesture.
 */
export function playClip(url: string, { onStart, onEnd, onFail }: PlayOptions = {}): void {
  try {
    const audio = new Audio(url);

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (ok) onEnd?.();
      else onFail?.();
    };

    audio.onplaying = () => onStart?.();
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    // play() rejects on a missing file or a blocked autoplay policy.
    audio.play().catch(() => finish(false));
  } catch {
    onFail?.();
  }
}

/**
 * Generates one clip with Deepgram and stores it.
 *
 * Only ever called for a word with no pre-generated clip, only when an adult
 * has turned live voice on, and only while the daily budget allows. Returns the
 * blob so the caller can use it now, or null if anything at all went wrong.
 */
export async function fetchLiveClip(
  word: string,
  lang: Lang,
  mode: ClipMode,
): Promise<Blob | null> {
  const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY ?? '';
  if (!apiKey || !canSpend()) return null;

  const text = speechTextFor(word, lang, mode === 'syllables');

  // Counted before the response arrives: a request that fails still costs the
  // attempt, and a budget that only counts successes is not a budget.
  spend();

  try {
    const response = await fetch(
      `${SPEAK_URL}?model=${encodeURIComponent(liveModelFor(lang))}&${AUDIO_PARAMS}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${apiKey}` },
        body: JSON.stringify({ text }),
      },
    );
    if (!response.ok) return null;

    const blob = await response.blob();
    await putClip(clipKey(voiceModel, lang, word, mode), blob);
    return blob;
  } catch {
    // Offline, blocked, or the key was revoked. The browser voice already
    // spoke, so there is nothing to recover from here.
    return null;
  }
}

/**
 * The Aura-2 voice for a language.
 *
 * Spanish uses whatever the manifest was generated with, so live words match
 * the rest. English has no pre-generated audio yet, so it borrows a voice in
 * the right language rather than speaking Spanish.
 */
function liveModelFor(lang: Lang): string {
  if (lang === 'es') return voiceModel;
  return 'aura-2-thalia-en';
}

export { getClip, clipKey, LANG_CODES };
