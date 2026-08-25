/**
 * Order-insensitive pictogram-ID matching for game mode.
 *
 * Plain functions, no React, no engine dependency. Lives outside src/aac
 * because it compares already-resolved pictogram IDs for a UI concern, not
 * resolution itself.
 */

/** Unique pictogram IDs from a ResolvedWord[], misses (null) dropped. */
export function pictogramIdSet(words) {
  const ids = new Set();
  for (const word of words) {
    if (word.pictogramId !== null) ids.add(word.pictogramId);
  }
  return ids;
}

/**
 * True when heldIds and liveIds contain exactly the same pictogram IDs,
 * regardless of order. Both empty never counts as a match: an empty attempt
 * has not repeated anything.
 */
export function isFullSetMatch(heldIds, liveIds) {
  if (heldIds.size === 0 || liveIds.size === 0) return false;
  if (heldIds.size !== liveIds.size) return false;
  for (const id of heldIds) {
    if (!liveIds.has(id)) return false;
  }
  return true;
}

/** IDs present in both sets, for the gentle echo highlight. */
export function intersectingIds(heldIds, liveIds) {
  const shared = new Set();
  for (const id of liveIds) {
    if (heldIds.has(id)) shared.add(id);
  }
  return shared;
}
