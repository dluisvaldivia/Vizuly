/**
 * ARASAAC API client.
 *
 * See .claude/rules/ARASAAC-API.md for the verified contract. The short version,
 * because both are easy to get wrong:
 *
 *   - A miss is HTTP 404, NOT an empty 200 array. Return null, do not throw.
 *   - Image URLs are static.arasaac.org/pictograms/{id}/{id}_{size}.png.
 *     The /images/ path in the original brief 404s.
 */

import type { Lang } from './types';
import { LANG_CODES } from './types';

const API_BASE = 'https://api.arasaac.org/api';
const STATIC_BASE = 'https://static.arasaac.org/pictograms';

/** Sizes ARASAAC actually publishes. 100 does not exist. Verified 2026-08-23. */
export type PictogramSize = 300 | 500 | 2500;

/** Network timeout. Generous: a slow answer beats a miss the child has to repeat. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Shape of a search result. ARASAAC returns far more fields than this; we
 * deliberately read only the id.
 *
 * Ranking fields (aac, schematic, tags) are intentionally NOT used. A heuristic
 * re-rank was tried and rejected: it fixed some words and broke others. Wrong
 * symbols are fixed with an overrides entry, never a ranking rule.
 */
interface ArasaacSearchResult {
  _id: number;
}

/** The URL for a pictogram image. Pure function, no network. */
export function pictogramImageUrl(id: number, size: PictogramSize = 500): string {
  return `${STATIC_BASE}/${id}/${id}_${size}.png`;
}

/**
 * One search request.
 *
 * Returns the first result's id, or null for a miss (404) or an empty array.
 * Throws only on a genuine failure worth retrying differently: network error,
 * timeout, or a 5xx.
 */
async function searchOnce(
  endpoint: 'bestsearch' | 'search',
  word: string,
  lang: Lang,
  signal?: AbortSignal,
): Promise<number | null> {
  const code = LANG_CODES[lang].arasaac;
  const url = `${API_BASE}/pictograms/${code}/${endpoint}/${encodeURIComponent(word)}`;

  const response = await fetchWithTimeout(url, signal);

  // A miss. This is the documented shape of "no pictogram for this word" and is
  // an ordinary outcome, not an error. Treating it as one is the single easiest
  // mistake to make against this API.
  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`ARASAAC ${endpoint} failed for "${word}" (${response.status})`);
  }

  const results = (await response.json()) as ArasaacSearchResult[];

  if (!Array.isArray(results) || results.length === 0) return null;

  const id = results[0]?._id;
  return typeof id === 'number' ? id : null;
}

/**
 * fetch with a timeout, honouring an optional caller-supplied abort signal.
 *
 * Kept separate so the timeout is testable and so callers cannot forget it. A
 * request that hangs forever would leave the strip stuck mid-render.
 */
async function fetchWithTimeout(url: string, signal?: AbortSignal): Promise<Response> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);

  // Abort if either the caller cancels or our timeout fires.
  const onCallerAbort = () => timeout.abort();
  signal?.addEventListener('abort', onCallerAbort);

  try {
    return await fetch(url, { signal: timeout.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

/**
 * Look up a word, preferring the precise endpoint.
 *
 * `bestsearch` first because it is exact-ish and handles plurals and accents.
 * `search` second because it is broader but noisier: it surfaces "gato" the
 * carpentry jack and "Papa Noel" sleighs. Falling back to it is still better
 * than showing the child nothing.
 *
 * Returns null when both miss.
 */
export async function findPictogramId(
  word: string,
  lang: Lang,
  signal?: AbortSignal,
): Promise<number | null> {
  const best = await searchOnce('bestsearch', word, lang, signal);
  if (best !== null) return best;

  return searchOnce('search', word, lang, signal);
}
