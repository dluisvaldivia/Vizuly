/**
 * Persisted child profiles.
 *
 * Several children can be stored, one active at a time. The active child's
 * name shows in game mode, and their age band decides which letter cards
 * appear. No children saved means an unnamed child at the youngest band.
 *
 * Same localStorage pattern as languageController.js.
 */

const STORAGE_KEY = 'vizuly.children.v1';

/** Minimum age of each band: 3 to 5, 6 to 8, 9 to 11. */
export const BANDS = [3, 6, 9];

const DEFAULT = { active: null, children: [] };

function isChild(c) {
  return (
    c &&
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    BANDS.includes(c.age)
  );
}

export function getInitialChildren() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || !Array.isArray(parsed.children) || !parsed.children.every(isChild)) return DEFAULT;
    const active = parsed.children.some((c) => c.id === parsed.active) ? parsed.active : null;
    return { active, children: parsed.children };
  } catch {
    return DEFAULT;
  }
}

export function setChildren(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable. The profiles still apply for this session.
  }
}

export function newChildId() {
  return globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36);
}

/** The active child, or null when none is chosen. */
export function activeChild(state) {
  return state.children.find((c) => c.id === state.active) ?? null;
}
