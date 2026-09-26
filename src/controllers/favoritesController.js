/**
 * Saved words and phrases, per child.
 *
 * A favourite is TEXT plus its language, never a pictogram id. Replaying it is
 * one say() call, which rebuilds the strip from the cache at no network cost, so
 * a pinned correction made after saving still takes effect. Storing an id here
 * would freeze a symbol the adult is allowed to change.
 *
 * Shape: { [childId]: [{ text, lang }] }. Same localStorage pattern as
 * ratingsController.js.
 *
 * A word and a phrase are the same thing here. The two sections the adult sees
 * are counted at render time, so nothing has to be migrated if that line moves.
 */

const STORAGE_KEY = 'vizuly.favorites.v1';

/**
 * The form two favourites are compared on.
 *
 * Edge punctuation is dropped because Deepgram returns "Quiero agua." while the
 * same phrase typed is "quiero agua", and those must be one favourite, not two.
 * Accents are NEVER stripped: sí and si are different words.
 *
 * Kept here rather than imported from the engine so the UI side keeps its single
 * seam into src/aac (useAac.ts) intact.
 */
function key(text) {
  return text.trim().toLowerCase().replace(/^[¿¡"'(]+|[.,;:!?"')]+$/gu, '');
}

function isFavorite(f) {
  return f && typeof f.text === 'string' && typeof f.lang === 'string';
}

export function getInitialFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    // One bad child entry drops that child, never the whole store.
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, list]) => Array.isArray(list) && list.every(isFavorite))
        .map(([childId, list]) => [childId, list]),
    );
  } catch {
    return {};
  }
}

export function setFavorites(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable. Favourites still apply for this session.
  }
}

/** This child's favourites in this language, in the order they were saved. */
export function favoritesFor(state, childId, lang) {
  return (state[childId] ?? []).filter((f) => f.lang === lang);
}

/** Whether this text is already saved for this child, in this language. */
export function isSaved(state, childId, lang, text) {
  const wanted = key(text);
  if (!wanted) return false;
  return favoritesFor(state, childId, lang).some((f) => key(f.text) === wanted);
}

/** A new state with the text saved, or removed if it already was. Pure. */
export function toggleFavorite(state, childId, lang, text) {
  if (!key(text)) return state;
  return isSaved(state, childId, lang, text)
    ? removeFavorite(state, childId, lang, text)
    : { ...state, [childId]: [...(state[childId] ?? []), { text: text.trim(), lang }] };
}

/** A new state without this text. Pure. */
export function removeFavorite(state, childId, lang, text) {
  const wanted = key(text);
  const list = (state[childId] ?? []).filter((f) => !(f.lang === lang && key(f.text) === wanted));
  return { ...state, [childId]: list };
}

/** A new state without this child's favourites. Pure. */
export function clearChildFavorites(state, childId) {
  const rest = { ...state };
  delete rest[childId];
  return rest;
}
