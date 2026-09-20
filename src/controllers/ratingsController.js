/**
 * Swipe ratings for letter cards, per child.
 *
 * A right swipe adds one, a left swipe takes one, clamped so no word can drift
 * out of reach forever. The score only changes the ORDER cards come up in: a
 * high score comes late, a low score comes early. It never removes a word and
 * is never shown to the child.
 *
 * Shape: { [childId]: { "lang.word": score } }. Same localStorage pattern as
 * languageController.js.
 */

const STORAGE_KEY = 'vizuly.ratings.v1';
const MIN = -3;
const MAX = 3;

export function getInitialRatings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function setRatings(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable. Ratings still apply for this session.
  }
}

/** A new state with the word's score moved by delta, clamped. Pure. */
export function rateWord(state, childId, lang, word, delta) {
  const key = `${lang}.${word}`;
  const scores = state[childId] ?? {};
  const next = Math.max(MIN, Math.min(MAX, (scores[key] ?? 0) + delta));
  return { ...state, [childId]: { ...scores, [key]: next } };
}

/** A new state without this child's ratings. Pure. */
export function clearChildRatings(state, childId) {
  const rest = { ...state };
  delete rest[childId];
  return rest;
}
